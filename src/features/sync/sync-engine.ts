import { useEffect, useRef } from 'react';
import axios from 'axios';
import * as SQLite from 'expo-sqlite';
import { apiClient, idempotent } from '@/lib/api/client';
import { toBackendSalePayload } from '@/lib/api/modules/sales.api';
import { useAuthStore } from '@/store/auth.store';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from './sync.store';
import { pullProducts } from './pull-sync';

interface OutboxItem {
  id: string;
  eventType: string;
  payload: string;
}

const MAX_BATCH = 100;

/** Map mobile khata payment methods to backend payment method enum. */
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

async function countPending(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox');
  return row?.count ?? 0;
}

/**
 * Dispatches a single outbox payload to the matching backend route.
 * Returns true when the server accepted it (or when the item is unrecoverable
 * and should be dropped to unblock the queue).
 */
async function dispatch(db: SQLite.SQLiteDatabase, item: OutboxItem): Promise<boolean> {
  const payload = JSON.parse(item.payload);

  // The outbox row id is the stable idempotency key for this operation, so a
  // retry of a request that already reached the server is deduped (never double
  // applied). Payloads also carry the same id where available.
  const idemKey: string = payload.id ?? item.id;

  switch (item.eventType) {
    case 'CREATE_SALE': {
      const res = await apiClient.post('/sales', toBackendSalePayload(payload), idempotent(idemKey));
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE sales SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'CASHBOOK_IN': {
      const res = await apiClient.post('/cashbook/cash-in', {
        amountCents: payload.amountCents,
        description: payload.description,
        reference: payload.reference ?? undefined,
      }, idempotent(idemKey));
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'CASHBOOK_OUT': {
      const res = await apiClient.post('/cashbook/cash-out', {
        amountCents: payload.amountCents,
        description: payload.description,
        reference: payload.reference ?? undefined,
      }, idempotent(idemKey));
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'STOCK_ADJUST': {
      const res = await apiClient.post(`/products/${payload.productId}/stock-adjustments`, {
        type: payload.type,
        quantity: payload.quantity,
        notes: payload.notes ?? undefined,
      }, idempotent(idemKey));
      return res.status === 200 || res.status === 201;
    }
    case 'COLLECT_DUE': {
      // Backend expects the khata account id in the URL.
      const res = await apiClient.post(`/khata/accounts/${payload.accountId}/collection`, {
        amountCents: payload.amountCents,
        method: mapKhataMethod(payload.paymentMethod),
        reference: payload.reference ?? undefined,
      }, idempotent(idemKey));
      if (res.status === 200 || res.status === 201) {
        if (payload.cashbookId) {
          await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.cashbookId]);
        }
        return true;
      }
      return false;
    }
    default:
      console.warn(`[SyncEngine] Dropping unknown event type: ${item.eventType}`);
      return true; // drop to unblock queue
  }
}

/** True for permanent client errors that will never succeed on retry. */
function isPermanentFailure(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    // No response → network/timeout → transient. 401 is handled by the
    // refresh interceptor. 4xx (validation/not-found/conflict) → permanent.
    if (status === undefined) return false;
    return status >= 400 && status < 500 && status !== 401 && status !== 429;
  }
  return false;
}

/**
 * Processes the entire outbox queue sequentially. Safe to call repeatedly;
 * uses the global sync store to prevent overlapping runs and to surface
 * progress to the UI. Stops early on the first network failure so unsynced
 * items are retried on the next connectivity/auth change.
 */
export async function processOutbox(db: SQLite.SQLiteDatabase): Promise<number> {
  const store = useSyncStore.getState();
  if (store.isSyncing) return 0;
  if (!useAuthStore.getState().isAuthenticated) return 0;
  if (!useNetworkStore.getState().isOnline) {
    store.setPendingCount(await countPending(db));
    return 0;
  }

  store.setSyncing(true);
  let processed = 0;
  try {
    while (processed < MAX_BATCH) {
      const item = await db.getFirstAsync<OutboxItem>(
        'SELECT id, eventType, payload FROM sync_outbox ORDER BY createdAt ASC LIMIT 1'
      );
      if (!item) break;

      let ok = false;
      try {
        ok = await dispatch(db, item);
      } catch (err) {
        if (isPermanentFailure(err)) {
          // Poison message: drop it so it can't block the rest of the queue.
          console.warn(
            `[SyncEngine] Dropping rejected ${item.eventType} (${item.id}):`,
            (err as Error)?.message,
          );
          await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [item.id]);
          processed += 1;
          continue;
        }
        // Transient (network/5xx): keep the item and stop; retry later.
        console.warn('[SyncEngine] Dispatch failed, will retry:', (err as Error)?.message);
        break;
      }

      if (ok) {
        await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [item.id]);
        useSyncStore.getState().setLastSyncAt(Date.now());
      } else {
        break;
      }
      processed += 1;
    }
  } finally {
    useSyncStore.getState().setPendingCount(await countPending(db));
    useSyncStore.getState().setSyncing(false);
  }
  return processed;
}

/**
 * Full sync: push the offline outbox first (so local changes win), then pull
 * the latest product catalog into the local cache. Used by manual "Sync Now"
 * and on connectivity/login transitions.
 */
export async function syncAll(db: SQLite.SQLiteDatabase): Promise<void> {
  await processOutbox(db);
  try {
    await pullProducts(db);
  } catch (err) {
    console.warn('[SyncEngine] Product pull failed:', (err as Error)?.message);
  }
}

/**
 * Auto-sync controller. Mount once near the app root (inside SQLiteProvider).
 * Runs a full push+pull whenever the device comes online or the user
 * authenticates, refreshes the pending count, and pushes periodically as a
 * safety net for transient failures.
 */
export function useAutoSync(): void {
  const db = SQLite.useSQLiteContext();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep pending badge accurate even while offline.
  useEffect(() => {
    void countPending(db).then(setPendingCount);
  }, [db, setPendingCount]);

  // React to connectivity / auth transitions: push outbox + pull catalog.
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      void syncAll(db);
    }
  }, [isOnline, isAuthenticated, db]);

  // Periodic safety-net retry while online + authenticated. Pushes the outbox,
  // and if anything actually synced, pulls the catalog so server stock (which
  // may have changed from another device) is reconciled back into the cache.
  useEffect(() => {
    if (!isAuthenticated) return;
    intervalRef.current = setInterval(() => {
      if (!useNetworkStore.getState().isOnline) return;
      void processOutbox(db).then((synced) => {
        if (synced > 0) {
          void pullProducts(db).catch((err) =>
            console.warn('[SyncEngine] Post-push pull failed:', (err as Error)?.message),
          );
        }
      });
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, db]);
}
