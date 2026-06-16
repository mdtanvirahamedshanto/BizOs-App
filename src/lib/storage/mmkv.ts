import { MMKV } from 'react-native-mmkv';

/**
 * Global persistent high-performance key-value store.
 * Replaces slow AsyncStorage with C++ JSI bindings.
 */
export const storage = new MMKV({
  id: 'bizos-app-storage',
  // In a real device setup, this can be encrypted by passing an encryption key:
  // encryptionKey: 'bizos-secure-encryption-key' 
});

export const storageKeys = {
  AUTH_TOKEN: 'auth.token',
  REFRESH_TOKEN: 'auth.refreshToken',
  USER_SESSION: 'auth.session',
  USER_PERMISSIONS: 'auth.permissions',
  ACTIVE_SHOP_ID: 'shop.activeId',
  LAST_SYNC_TS: 'sync.lastSuccessTimestamp',
  SETTINGS_THEME: 'settings.theme',
};

export const kvStorage = {
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  getItem: (key: string): string | undefined => {
    return storage.getString(key);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
  clear: (): void => {
    storage.clearAll();
  },
  
  // JSON Helpers
  setObject: <T>(key: string, value: T): void => {
    storage.set(key, JSON.stringify(value));
  },
  getObject: <T>(key: string): T | null => {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
};
