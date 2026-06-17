import { useCallback, useEffect, useRef } from 'react';
import * as SQLite from 'expo-sqlite';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from './sync.store';

interface OutboxItem {
  id: string;
  eventType: string;
  payload: string;
}

const MAX_BATCH = 50;

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

  switch (item.eventType) {
    case 'CREATE_SALE': {
      const res = await apiClient.post('/sales', payload);
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE sales SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'CASHBOOK_IN': {
      const res = await apiClient.post('/cashbook/cash-in', payload);
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'CASHBOOK_OUT': {
      const res = await apiClient.post('/cashbook/cash-out', payload);
      if (res.status === 200 || res.status === 201) {
        await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
        return true;
      }
      return false;
    }
    case 'COLLECT_DUE': {
      const res = await apiClient.post('/khata/collection', {
        accountId: payload.accountId,
        amountCents: payload.amountCents,
        paymentMethod: payload.paymentMethod,
        reference: payload.reference,
      });
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

/**
 * Processes the entire outbox queue sequentially. Safe to call repeatedly;
 * uses the global sync store to prevent overlapping runs and to surface
 * progress to the UI. Stops early on the first network failure so unsynced
 * items are retried on the next connectivity/auth change.
 */
export async function processOutbox(db: SQLite.SQLiteDatabase): Promise<void> {
  const store = useSyncStore.getState();
  if (store.isSyncing) return;
  if (!useAuthStore.getState().isAuthenticated) return;
  if (!useNetworkStore.getState().isOnline) {
    store.setPendingCount(await countPending(db));
    return;
  }

  store.setSyncing(true);
  try {
    let processed = 0;
    while (processed < MAX_BATCH) {
      const item = await db.getFirstAsync<OutboxItem>(
        'SELECT id, eventType, payload FROM sync_outbox ORDER BY createdAt ASC LIMIT 1'
      );
      if (!item) break;

      let ok = false;
      try {
        ok = await dispatch(db, item);
      } catch (err) {
        // Network / server error: keep the item and stop; retry later.
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
}

/**
 * Auto-sync controller. Mount once near the app root (inside SQLiteProvider).
 * Triggers the outbox processor whenever the device comes online or the user
 * authenticates, refreshes the pending count, and polls periodically as a
 * safety net for transient failures.
 */
export function useAutoSync(): void {
  const db = SQLite.useSQLiteContext();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(() => {
    void processOutbox(db);
  }, [db]);

  // Keep pending badge accurate even while offline.
  useEffect(() => {
    void countPending(db).then(setPendingCount);
  }, [db, setPendingCount]);

  // React to connectivity / auth transitions.
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      run();
    }
  }, [isOnline, isAuthenticated, run]);

  // Periodic safety-net retry while online + authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    intervalRef.current = setInterval(() => {
      if (useNetworkStore.getState().isOnline) run();
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, run]);
}
