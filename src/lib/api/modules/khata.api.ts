import { apiClient, idempotent } from '../client';
import * as SQLite from 'expo-sqlite';

/** Map mobile khata payment methods to the backend payment method enum. */
function mapKhataMethod(method: string): string {
  switch (method) {
    case 'CASH':
      return 'CASH';
    case 'BANK':
      return 'BANK';
    case 'MFS':
      return 'BKASH';
    default:
      return 'OTHER';
  }
}

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

      // Stable id reused for the outbox row AND the idempotency key so an
      // online attempt and any later retry are deduped to one collection.
      const collectionId = input.id || Math.random().toString();

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

      const outboxPayload = JSON.stringify({ ...input, id: collectionId, cashbookId });

      // 4. Queue in outbox if offline
      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [collectionId, 'COLLECT_DUE', outboxPayload, 0, Date.now()]
        );
        return { success: true, offline: true };
      }

      // 5. Post to backend if online (backend keys collection by account id in URL)
      try {
        await apiClient.post(
          `/khata/accounts/${input.accountId}/collection`,
          {
            amountCents: input.amountCents,
            method: mapKhataMethod(input.paymentMethod),
            reference: input.reference,
          },
          idempotent(collectionId)
        );
        return { success: true, offline: false };
      } catch (err) {
        // Fallback: Queue in outbox on network failure
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [collectionId, 'COLLECT_DUE', outboxPayload, 0, Date.now()]
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

