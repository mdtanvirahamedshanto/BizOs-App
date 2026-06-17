import { create } from 'zustand';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  shopId?: string;
  /** Display role derived from permissions (backend does not return a role). */
  role?: string;
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
    if (user.shopId) {
      kvStorage.setItem(storageKeys.ACTIVE_SHOP_ID, user.shopId);
    }

    set({
      isAuthenticated: true,
      user,
      permissions,
      activeShopId: user.shopId ?? null,
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
 * Returns true if the permission list grants the required permission.
 * Owners/SuperAdmins receive a wildcard (`*` or `*:*:*`) from the backend.
 */
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  if (permissions.includes('*') || permissions.includes('*:*:*')) return true;
  if (permissions.includes(requiredPermission)) return true;
  // Support `resource.*` wildcards (e.g. "products.*" grants "products.read").
  const [resource] = requiredPermission.split('.');
  if (resource && permissions.includes(`${resource}.*`)) return true;
  return false;
}

/**
 * Hook to assert Role-Based Access Control inside screens.
 */
export function useHasPermission(requiredPermission: string): boolean {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);

  if (!user) return false;
  if (user.role === 'SuperAdmin' || user.role === 'Owner') return true;
  return hasPermission(permissions, requiredPermission);
}
