import { apiClient } from '../client';
import * as SQLite from 'expo-sqlite';

export interface CashbookEntryInput {
  id: string; // Client-generated UUID
  amountCents: number;
  description: string;
  reference?: string;
  source: 'MANUAL' | 'SALE' | 'EXPENSE';
  createdAt: number;
}

export interface CashbookEntry {
  id: string;
  type: 'IN' | 'OUT';
  amountCents: number;
  description: string;
  source: string;
  reference?: string;
  isSynced: number;
  createdAt: number;
}

export const cashbookApi = {
  /**
   * Records a manual or system cash inflow.
   */
  recordCashIn: async (
    db: SQLite.SQLiteDatabase,
    input: CashbookEntryInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      // 1. Commit locally to SQLite cashbook_entries
      await db.runAsync(
        `INSERT INTO cashbook_entries (id, type, amountCents, description, source, reference, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          'IN',
          input.amountCents,
          input.description,
          input.source,
          input.reference || null,
          isOffline ? 0 : 1,
          input.createdAt,
        ]
      );

      // 2. Queue in outbox if offline
      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CASHBOOK_IN',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      // 3. Post to backend if online
      try {
        await apiClient.post('/cashbook/cash-in', input);
        return { success: true, offline: false };
      } catch (err) {
        // Fallback: Queue in outbox on sync error
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 0 WHERE id = ?', [input.id]);
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CASHBOOK_IN',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[CashbookAPI] Local cash-in transaction failure:', dbError);
      throw dbError;
    }
  },

  /**
   * Records a manual or system cash outflow.
   */
  recordCashOut: async (
    db: SQLite.SQLiteDatabase,
    input: CashbookEntryInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      // 1. Commit locally to SQLite cashbook_entries
      await db.runAsync(
        `INSERT INTO cashbook_entries (id, type, amountCents, description, source, reference, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          'OUT',
          input.amountCents,
          input.description,
          input.source,
          input.reference || null,
          isOffline ? 0 : 1,
          input.createdAt,
        ]
      );

      // 2. Queue in outbox if offline
      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CASHBOOK_OUT',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      // 3. Post to backend if online
      try {
        await apiClient.post('/cashbook/cash-out', input);
        return { success: true, offline: false };
      } catch (err) {
        // Fallback: Queue in outbox on sync error
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 0 WHERE id = ?', [input.id]);
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CASHBOOK_OUT',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[CashbookAPI] Local cash-out transaction failure:', dbError);
      throw dbError;
    }
  },

  /**
   * Fetches the current balance of the active shop cash drawer.
   */
  getCurrentBalance: async (): Promise<{ success: boolean; data: { currentBalanceCents: number } }> => {
    const response = await apiClient.get<{ success: boolean; data: { currentBalanceCents: number } }>('/cashbook/balance');
    return response.data;
  },
};
export default cashbookApi;
