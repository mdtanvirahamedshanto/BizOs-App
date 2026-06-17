import { create } from 'zustand';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  setSyncing: (value: boolean) => void;
  setPendingCount: (value: number) => void;
  setLastSyncAt: (value: number) => void;
}

const initialLastSync = Number(kvStorage.getItem(storageKeys.LAST_SYNC_TS)) || null;

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: initialLastSync,
  setSyncing: (value) => set({ isSyncing: value }),
  setPendingCount: (value) => set({ pendingCount: value }),
  setLastSyncAt: (value) => {
    kvStorage.setItem(storageKeys.LAST_SYNC_TS, String(value));
    set({ lastSyncAt: value });
  },
}));
