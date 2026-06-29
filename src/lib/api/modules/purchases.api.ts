import { apiClient, idempotent } from '../client';
import * as SQLite from 'expo-sqlite';
import { newId } from '@/lib/id';

export interface PurchaseItemInput {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCostCents: number;
}

export interface PurchaseInput {
  id: string;
  supplierId?: string;
  referenceNumber: string;
  items: PurchaseItemInput[];
  totalCents: number;
  taxCents: number;
  discountCents: number;
  paymentStatus: 'PAID' | 'DUE' | 'PARTIAL';
  createdAt: number;
}

export interface Purchase {
  id: string;
  supplierId?: string;
  referenceNumber: string;
  totalCents: number;
  taxCents: number;
  discountCents: number;
  paymentStatus: string;
  isSynced: number;
  createdAt: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackendPurchasePayload {
  supplierId?: string;
  purchaseDate?: string;
  referenceNumber: string;
  items: { productId: string; quantity: number; unitCostCents: number }[];
  payment?: { amountCents: number; method: 'CASH'; reference?: string };
}

export function toBackendPurchasePayload(input: PurchaseInput): BackendPurchasePayload {
  const payload: BackendPurchasePayload = {
    purchaseDate: new Date(input.createdAt).toISOString(),
    referenceNumber: input.referenceNumber || `PUR-${Date.now()}`,
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCostCents: i.unitCostCents })),
  };

  if (input.supplierId && UUID_RE.test(input.supplierId)) {
    payload.supplierId = input.supplierId;
  }
  if (input.paymentStatus === 'PAID') {
    payload.payment = { amountCents: input.totalCents, method: 'CASH' };
  }

  return payload;
}

export const purchasesApi = {
  createPurchase: async (
    db: SQLite.SQLiteDatabase,
    input: PurchaseInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      await db.runAsync(
        `INSERT INTO purchases (id, supplierId, referenceNumber, totalCents, taxCents, discountCents, paymentStatus, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.supplierId || null,
          input.referenceNumber,
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
          `INSERT INTO purchase_items (id, purchaseId, productId, quantity, unitCostCents)
           VALUES (?, ?, ?, ?, ?)`,
          [
            newId(),
            input.id,
            item.productId,
            item.quantity,
            item.unitCostCents,
          ]
        );

        // Increase inventory stock levels locally
        await db.runAsync(
          `UPDATE products SET stock = stock + ? WHERE id = ?`,
          [item.quantity, item.productId]
        );
      }

      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_PURCHASE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      try {
        await apiClient.post('/purchases', toBackendPurchasePayload(input), idempotent(input.id));
        return { success: true, offline: false };
      } catch (err) {
        await db.runAsync('UPDATE purchases SET isSynced = 0 WHERE id = ?', [input.id]);
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_PURCHASE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[PurchasesAPI] Local db transaction failure:', dbError);
      throw dbError;
    }
  },

  listPurchases: async (params?: { limit?: number; cursor?: string }): Promise<{ success: boolean; data: Purchase[] }> => {
    const response = await apiClient.get<{ success: boolean; data: Purchase[] }>('/purchases', { params });
    return response.data;
  },
};
export default purchasesApi;
