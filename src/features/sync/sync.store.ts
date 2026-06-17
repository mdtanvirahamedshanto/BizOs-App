import { create } from 'zustand';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  /** Number of items the server permanently rejected (dead-letter queue). */
  failedCount: number;
  lastSyncAt: number | null;
  setSyncing: (value: boolean) => void;
  setPendingCount: (value: number) => void;
  setFailedCount: (value: number) => void;
  setLastSyncAt: (value: number) => void;
}

const initialLastSync = Number(kvStorage.getItem(storageKeys.LAST_SYNC_TS)) || null;

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: initialLastSync,
  setSyncing: (value) => set({ isSyncing: value }),
  setPendingCount: (value) => set({ pendingCount: value }),
  setFailedCount: (value) => set({ failedCount: value }),
  setLastSyncAt: (value) => {
    kvStorage.setItem(storageKeys.LAST_SYNC_TS, String(value));
    set({ lastSyncAt: value });
  },
}));
