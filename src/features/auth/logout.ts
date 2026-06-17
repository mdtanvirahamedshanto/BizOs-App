import { authApi } from '@/lib/api/modules/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

/**
 * Logs the user out everywhere: revokes the refresh token server-side
 * (best-effort) and then clears all local credentials/state.
 */
export async function logoutAndRevoke(): Promise<void> {
  const refreshToken = kvStorage.getItem(storageKeys.REFRESH_TOKEN);
  try {
    await authApi.logout(refreshToken);
  } catch {
    // Offline or token already invalid — proceed with local logout regardless.
  } finally {
    useAuthStore.getState().logout();
  }
}
