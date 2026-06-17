import * as SQLite from 'expo-sqlite';
import { productsApi, mapBackendProduct } from '@/lib/api/modules/products.api';
import { useAuthStore } from '@/store/auth.store';
import { useNetworkStore } from '@/lib/network/network.store';

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap (5000 products)

/**
 * Pulls the product catalog from the backend and upserts it into the local
 * SQLite cache so POS / Inventory work fully offline. Server is the source of
 * truth for product master data; call this AFTER pushing the outbox so local
 * offline stock changes are uploaded first.
 *
 * Returns the number of products synced, or -1 if skipped (offline/unauth).
 */
export async function pullProducts(db: SQLite.SQLiteDatabase): Promise<number> {
  if (!useAuthStore.getState().isAuthenticated) return -1;
  if (!useNetworkStore.getState().isOnline) return -1;

  let cursor: string | undefined;
  let page = 0;
  let synced = 0;

  while (page < MAX_PAGES) {
    const res = await productsApi.listProducts({ limit: PAGE_SIZE, cursor });
    const items = res.data?.data ?? [];
    if (items.length === 0) break;

    await db.withTransactionAsync(async () => {
      for (const raw of items) {
        const p = mapBackendProduct(raw);
        await db.runAsync(
          `INSERT OR REPLACE INTO products
            (id, sku, barcode, name, stock, priceCents, costPriceCents, lowStockThreshold, lastUpdated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.sku,
            p.barcode ?? null,
            p.name,
            p.stock,
            p.priceCents,
            p.costPriceCents ?? 0,
            p.lowStockThreshold ?? 10,
            p.lastUpdated,
          ],
        );
      }
    });

    synced += items.length;
    const next = res.data?.meta?.nextCursor;
    if (!next) break;
    cursor = next;
    page += 1;
  }

  return synced;
}
