import { useState, useCallback } from 'react';
import * as SQLite from 'expo-sqlite';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';

interface OutboxItem {
  id: string;
  eventType: string;
  payload: string;
}

/**
 * Hook interface driving queue replication logic from local SQLite storage.
 * Evaluates pending transaction outbox logs and reconciles state with backend APIs.
 */
export function useSyncEngine() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const db = SQLite.useSQLiteContext();

  const triggerSync = useCallback(async () => {
    // Prevent duplicate sync cycles or unauthenticated synchronization
    if (isSyncing || !isAuthenticated) return;
    setIsSyncing(true);

    try {
      // 1. Fetch the oldest pending outbox record
      const item = await db.getFirstAsync<OutboxItem>(
        'SELECT id, eventType, payload FROM sync_outbox WHERE isProcessing = 0 ORDER BY createdAt ASC LIMIT 1'
      );

      if (!item) {
        setIsSyncing(false);
        return; // Queue is fully synchronized
      }

      // 2. Lock item to prevent race conditions during active HTTP execution
      await db.runAsync('UPDATE sync_outbox SET isProcessing = 1 WHERE id = ?', [item.id]);

      const payload = JSON.parse(item.payload);
      let syncSuccess = false;

      // 3. Dispatch payload to matching API route depending on action type
      switch (item.eventType) {
        case 'CREATE_SALE': {
          const response = await apiClient.post('/sales', payload);
          if (response.status === 201 || response.status === 200) {
            syncSuccess = true;
            // Mark sale isSynced local state
            await db.runAsync('UPDATE sales SET isSynced = 1 WHERE id = ?', [payload.id]);
          }
          break;
        }

        case 'CASHBOOK_IN': {
          const response = await apiClient.post('/cashbook/cash-in', payload);
          if (response.status === 201 || response.status === 200) {
            syncSuccess = true;
            await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
          }
          break;
        }

        case 'CASHBOOK_OUT': {
          const response = await apiClient.post('/cashbook/cash-out', payload);
          if (response.status === 201 || response.status === 200) {
            syncSuccess = true;
            await db.runAsync('UPDATE cashbook_entries SET isSynced = 1 WHERE id = ?', [payload.id]);
          }
          break;
        }

        default:
          console.warn(`[SyncEngine] Unrecognized event type omitted: ${item.eventType}`);
          // Remove anomalous item to unblock the outbox loop
          syncSuccess = true;
          break;
      }

      if (syncSuccess) {
        // 4. Remove successfully synchronized outbox item
        await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [item.id]);
      } else {
        // Release lock on failures to allow retries
        await db.runAsync('UPDATE sync_outbox SET isProcessing = 0 WHERE id = ?', [item.id]);
      }

      setIsSyncing(false);

      // Recursive call with minor tick delay to process next item in queue
      setTimeout(() => {
        void triggerSync();
      }, 50);

    } catch (error) {
      console.error('[SyncEngine] Synchronization loop failure:', error);
      setIsSyncing(false);
    }
  }, [db, isAuthenticated, isSyncing]);

  return {
    triggerSync,
    isSyncing,
  };
}
