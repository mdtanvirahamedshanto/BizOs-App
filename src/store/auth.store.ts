import { create } from 'zustand';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string; // e.g. 'SuperAdmin' | 'Admin' | 'Manager' | 'Staff'
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserSession | null;
  permissions: string[];
  activeShopId: string | null;
  
  // Actions
  login: (accessToken: string, refreshToken: string, user: UserSession, permissions: string[]) => void;
  logout: () => void;
  setActiveShopId: (shopId: string) => void;
}

// Read initial states synchronously from high-speed MMKV storage
const initialUser = kvStorage.getObject<UserSession>(storageKeys.USER_SESSION);
const initialPermissions = kvStorage.getObject<string[]>(storageKeys.USER_PERMISSIONS) || [];
const initialActiveShop = kvStorage.getItem(storageKeys.ACTIVE_SHOP_ID) || null;
const initialToken = kvStorage.getItem(storageKeys.AUTH_TOKEN);

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!initialToken && !!initialUser,
  user: initialUser,
  permissions: initialPermissions,
  activeShopId: initialActiveShop,

  login: (accessToken, refreshToken, user, permissions) => {
    kvStorage.setItem(storageKeys.AUTH_TOKEN, accessToken);
    kvStorage.setItem(storageKeys.REFRESH_TOKEN, refreshToken);
    kvStorage.setObject(storageKeys.USER_SESSION, user);
    kvStorage.setObject(storageKeys.USER_PERMISSIONS, permissions);

    set({
      isAuthenticated: true,
      user,
      permissions,
    });
  },

  logout: () => {
    kvStorage.removeItem(storageKeys.AUTH_TOKEN);
    kvStorage.removeItem(storageKeys.REFRESH_TOKEN);
    kvStorage.removeItem(storageKeys.USER_SESSION);
    kvStorage.removeItem(storageKeys.USER_PERMISSIONS);
    kvStorage.removeItem(storageKeys.ACTIVE_SHOP_ID);

    set({
      isAuthenticated: false,
      user: null,
      permissions: [],
      activeShopId: null,
    });
  },

  setActiveShopId: (shopId) => {
    kvStorage.setItem(storageKeys.ACTIVE_SHOP_ID, shopId);
    set({ activeShopId: shopId });
  },
}));

/**
 * Custom React Hook to assert Role-Based Access Control inside screens.
 * Evaluates permission matrices or auto-authorizes SuperAdmin accounts.
 */
export function useHasPermission(requiredPermission: string): boolean {
  const { user, permissions } = useAuthStore();
  
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  
  return permissions.includes(requiredPermission);
}
