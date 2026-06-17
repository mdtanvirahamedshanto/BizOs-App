import { apiClient, idempotent } from '../client';
import * as SQLite from 'expo-sqlite';
import { newId } from '@/lib/id';

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

/** Khata account as returned by the backend `/khata/accounts` endpoint. */
export interface BackendKhataAccount {
  id: string; // khata account id (used in collection URL)
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyId: string;
  balanceCents: number; // +ve = customer owes (receivable)
  creditLimitCents: number;
  isActive: boolean;
  updatedAt?: string;
  customer?: { id: string; name: string; phone?: string | null } | null;
}

export interface PaginatedKhataAccounts {
  success: boolean;
  data: {
    data: BackendKhataAccount[];
    meta?: { nextCursor?: string | null; hasMore?: boolean; total?: number };
  };
}

/** Local SQLite customer shape derived from a backend khata account. */
export interface LocalCustomer {
  id: string;
  name: string;
  phone: string | null;
  dueCents: number;
  creditLimitCents: number;
  khataAccountId: string;
  lastUpdated: number;
}

/**
 * Normalize a backend customer khata account into the local customers row.
 * Returns null for accounts without a linked customer (e.g. supplier accounts).
 */
export function mapKhataAccountToCustomer(a: BackendKhataAccount): LocalCustomer | null {
  if (a.partyType !== 'CUSTOMER' || !a.customer) return null;
  return {
    id: a.customer.id,
    name: a.customer.name,
    phone: a.customer.phone ?? null,
    dueCents: a.balanceCents ?? 0,
    creditLimitCents: a.creditLimitCents ?? 0,
    khataAccountId: a.id,
    lastUpdated: a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now(),
  };
}

export const khataApi = {
  /**
   * Fetches a page of khata accounts (paginated). Pass `partyType: 'CUSTOMER'`
   * to limit to customer ledgers for offline caching.
   */
  listAccounts: async (params?: {
    limit?: number;
    cursor?: string;
    partyType?: 'CUSTOMER' | 'SUPPLIER';
  }): Promise<PaginatedKhataAccounts> => {
    const response = await apiClient.get<PaginatedKhataAccounts>('/khata/accounts', { params });
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
      const collectionId = input.id || newId();

      // 3. Add transaction matching cashbook inflows
      const cashbookId = input.cashbookId || newId();
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

