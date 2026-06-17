import { apiClient } from '../client';
import * as SQLite from 'expo-sqlite';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  priceCents: number;
}

export interface SaleInput {
  id: string; // Client-side generated UUID
  customerId?: string;
  items: SaleItemInput[];
  totalCents: number;
  taxCents: number;
  discountCents: number;
  paymentStatus: 'PAID' | 'DUE' | 'PARTIAL';
  createdAt: number;
}

export interface Sale {
  id: string;
  customerId?: string;
  totalCents: number;
  taxCents: number;
  discountCents: number;
  paymentStatus: string;
  isSynced: number;
  createdAt: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackendSalePayload {
  customerId?: string;
  saleDate?: string;
  discountType?: 'FIXED';
  discountValue?: number;
  items: { productId: string; quantity: number }[];
  payment?: { amountCents: number; method: 'CASH'; reference?: string };
}

/**
 * Transform the local mobile sale into the backend `POST /sales` DTO.
 * The backend derives line prices and totals from the product catalog, so we
 * only send productId + quantity. A PAID sale includes a cash payment for the
 * computed total; DUE/PARTIAL sales are left unpaid for the backend to track.
 */
export function toBackendSalePayload(input: SaleInput): BackendSalePayload {
  const payload: BackendSalePayload = {
    saleDate: new Date(input.createdAt).toISOString(),
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  };

  if (input.customerId && UUID_RE.test(input.customerId)) {
    payload.customerId = input.customerId;
  }
  if (input.discountCents > 0) {
    payload.discountType = 'FIXED';
    payload.discountValue = input.discountCents;
  }
  if (input.paymentStatus === 'PAID') {
    payload.payment = { amountCents: input.totalCents, method: 'CASH' };
  }

  return payload;
}

export const salesApi = {
  /**
   * Submits a POS cashier checkout transaction.
   * Performs an instant local write with local stock adjustments, enqueues to outbox when offline, 
   * and falls back gracefully to local outbox processing if the server request fails.
   */
  createSale: async (
    db: SQLite.SQLiteDatabase,
    input: SaleInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      // 1. Commit locally to SQLite first to ensure the transaction is recorded immediately
      await db.runAsync(
        `INSERT INTO sales (id, customerId, totalCents, taxCents, discountCents, paymentStatus, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.customerId || null,
          input.totalCents,
          input.taxCents,
          input.discountCents,
          input.paymentStatus,
          isOffline ? 0 : 1,
          input.createdAt,
        ]
      );

      for (const item of input.items) {
        await db.runAsync(
          `INSERT INTO sale_items (id, saleId, productId, quantity, priceCents)
           VALUES (?, ?, ?, ?, ?)`,
          [
            Math.random().toString(), // Local item ID mapping
            input.id,
            item.productId,
            item.quantity,
            item.priceCents,
          ]
        );

        // Deduct inventory stock levels locally
        await db.runAsync(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [item.quantity, item.productId]
        );
      }

      // 2. Queue in outbox if actively offline
      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_SALE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      // 3. Post to backend if online
      try {
        await apiClient.post('/sales', toBackendSalePayload(input));
        return { success: true, offline: false };
      } catch (err) {
        // Fallback: If network times out, mark local record unsynced, queue to outbox, and return success
        await db.runAsync('UPDATE sales SET isSynced = 0 WHERE id = ?', [input.id]);
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_SALE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[SalesAPI] Local db transaction failure:', dbError);
      throw dbError;
    }
  },

  /**
   * Fetches sales transaction history.
   */
  listSales: async (params?: { limit?: number; cursor?: string }): Promise<{ success: boolean; data: Sale[] }> => {
    const response = await apiClient.get<{ success: boolean; data: Sale[] }>('/sales', { params });
    return response.data;
  },
};
export default salesApi;
