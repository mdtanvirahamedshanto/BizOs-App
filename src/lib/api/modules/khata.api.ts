import { apiClient } from '../client';
import * as SQLite from 'expo-sqlite';

export interface KhataAccount {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  balanceCents: number; // positive = customer owes due, negative = advance/credit
  lastTransactionAt?: number;
}

export interface CollectionInput {
  id?: string;
  customerId: string;
  accountId: string;
  amountCents: number;
  paymentMethod: 'CASH' | 'MFS' | 'BANK';
  reference?: string;
  createdAt: number;
  cashbookId?: string;
}

export const khataApi = {
  /**
   * Fetches customer ledger accounts lists.
   */
  listAccounts: async (params?: { search?: string }): Promise<{ success: boolean; data: KhataAccount[] }> => {
    const response = await apiClient.get<{ success: boolean; data: KhataAccount[] }>('/khata/accounts', { params });
    return response.data;
  },

  /**
   * Records a due collection payment received from a customer.
   * Updates local SQLite customer due balance, records cashbook entry, and queues in background outbox if offline.
   */
  recordCollection: async (
    db: SQLite.SQLiteDatabase,
    input: CollectionInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      // 1. Update customer due status locally in SQLite
      await db.runAsync(
        `UPDATE customers SET dueCents = dueCents - ? WHERE id = ?`,
        [input.amountCents, input.customerId]
      );

      // 2. Fetch customer name to add a descriptive cashbook entry
      const customerRow = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM customers WHERE id = ?`,
        [input.customerId]
      );
      const customerName = customerRow?.name || 'Customer';

      // 3. Add transaction matching cashbook inflows
      const cashbookId = input.cashbookId || Math.random().toString();
      await db.runAsync(
        `INSERT INTO cashbook_entries (id, type, amountCents, description, source, reference, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cashbookId,
          'IN',
          input.amountCents,
          `বাকি আদায় - ${customerName}`,
          'MANUAL',
          input.reference || `Collection method: ${input.paymentMethod}`,
          isOffline ? 0 : 1,
          input.createdAt,
        ]
      );

      // 4. Queue in outbox if offline
      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id || Math.random().toString(),
            'COLLECT_DUE',
            JSON.stringify({ ...input, cashbookId }),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      // 5. Post to backend if online
      try {
        const apiPayload = {
          accountId: input.accountId,
          amountCents: input.amountCents,
          paymentMethod: input.paymentMethod,
          reference: input.reference,
        };
        await apiClient.post('/khata/collection', apiPayload);
        return { success: true, offline: false };
      } catch (err) {
        // Fallback: Queue in outbox on network failure
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id || Math.random().toString(),
            'COLLECT_DUE',
            JSON.stringify({ ...input, cashbookId }),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[KhataAPI] Local collect due transaction failure:', dbError);
      throw dbError;
    }
  },
};
export default khataApi;

