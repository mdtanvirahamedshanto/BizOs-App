import * as SQLite from 'expo-sqlite';
import { productsApi, mapBackendProduct } from '@/lib/api/modules/products.api';
import { khataApi, mapKhataAccountToCustomer } from '@/lib/api/modules/khata.api';
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

/**
 * Pulls customer khata accounts from the backend and upserts them into the
 * local `customers` cache. Each row keeps the backend khata account id so due
 * collections recorded offline can be synced to the correct ledger account.
 * Due balance (`dueCents`) is server-authoritative — call AFTER pushing the
 * outbox so locally-recorded collections are uploaded first.
 *
 * Returns the number of customers synced, or -1 if skipped (offline/unauth).
 */
export async function pullCustomers(db: SQLite.SQLiteDatabase): Promise<number> {
  if (!useAuthStore.getState().isAuthenticated) return -1;
  if (!useNetworkStore.getState().isOnline) return -1;

  let cursor: string | undefined;
  let page = 0;
  let synced = 0;

  while (page < MAX_PAGES) {
    const res = await khataApi.listAccounts({ limit: PAGE_SIZE, cursor, partyType: 'CUSTOMER' });
    const items = res.data?.data ?? [];
    if (items.length === 0) break;

    await db.withTransactionAsync(async () => {
      for (const raw of items) {
        const c = mapKhataAccountToCustomer(raw);
        if (!c) continue;
        // Upsert without clobbering rows the user may be editing: update master
        // fields + server due balance, insert when new.
        await db.runAsync(
          `INSERT INTO customers (id, name, phone, dueCents, creditLimitCents, khataAccountId, lastUpdated)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone = excluded.phone,
             dueCents = excluded.dueCents,
             creditLimitCents = excluded.creditLimitCents,
             khataAccountId = excluded.khataAccountId,
             lastUpdated = excluded.lastUpdated`,
          [c.id, c.name, c.phone, c.dueCents, c.creditLimitCents, c.khataAccountId, c.lastUpdated],
        );
        synced += 1;
      }
    });

    const next = res.data?.meta?.nextCursor;
    if (!next) break;
    cursor = next;
    page += 1;
  }

  return synced;
}
