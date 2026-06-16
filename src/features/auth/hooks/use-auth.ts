import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, LoginInput } from '@/lib/api/modules/auth.api';
import { useAuthStore, UserSession } from '@/store/auth.store';
import { biometrics } from '@/lib/auth/biometrics';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

/**
 * Global authentication hook driving Login, Register, Logout, and Biometric unlock gates.
 */
export function useAuth() {
  const { login: storeLogin, logout: storeLogout } = useAuthStore();
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  // 1. Credentials-Based Login Mutation
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      const { accessToken, refreshToken, user, permissions } = response.data;
      
      // Save credentials to Zustand + MMKV
      storeLogin(accessToken, refreshToken, user, permissions);

      // Auto-enable biometrics if supported by device hardware for subsequent quick logs
      void biometrics.isSupported().then((supported) => {
        if (supported && !biometrics.isEnabledInSettings()) {
          biometrics.setEnabledInSettings(true);
        }
      });
    },
  });

  // 2. Local Biometrics Security Gate
  const performBiometricLogin = useCallback(async (): Promise<boolean> => {
    const isSupported = await biometrics.isSupported();
    const isEnabled = biometrics.isEnabledInSettings();
    const hasToken = !!kvStorage.getItem(storageKeys.AUTH_TOKEN);
    const cachedUser = kvStorage.getObject<UserSession>(storageKeys.USER_SESSION);
    const cachedPerms = kvStorage.getObject<string[]>(storageKeys.USER_PERMISSIONS);

    // Skip biometric trigger if device is not configured or cache is empty
    if (!isSupported || !isEnabled || !hasToken || !cachedUser) {
      return false;
    }

    setIsBiometricLoading(true);
    try {
      const success = await biometrics.authenticate('Unlock your BizOS Session');
      if (success) {
        const token = kvStorage.getItem(storageKeys.AUTH_TOKEN)!;
        const refresh = kvStorage.getItem(storageKeys.REFRESH_TOKEN)!;
        
        // Restore active user state to layout Navigators
        storeLogin(token, refresh, cachedUser, cachedPerms || []);
        setIsBiometricLoading(false);
        return true;
      }
    } catch (error) {
      console.error('[Biometrics] Local unlock error:', error);
    }
    setIsBiometricLoading(false);
    return false;
  }, [storeLogin]);

  return {
    login: loginMutation.mutate,
    isPending: loginMutation.isPending,
    error: loginMutation.error,
    logout: storeLogout,
    performBiometricLogin,
    isBiometricLoading,
  };
}
