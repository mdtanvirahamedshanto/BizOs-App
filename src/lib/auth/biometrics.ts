import * as LocalAuthentication from 'expo-local-authentication';
import { kvStorage } from '@/lib/storage/mmkv';

/**
 * Biometrics Authentication manager.
 * Interfaces with OS-level face/fingerprint locks.
 */
export const biometrics = {
  /**
   * Evaluates if device has biometric hardware (Face ID, Touch ID, Fingerprint)
   * and if the user has enrolled authentication credentials.
   */
  isSupported: async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  },

  /**
   * Invokes the OS-level local biometric confirmation prompt.
   */
  authenticate: async (promptMessage: string = 'Confirm identity to login'): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * Checks if user has toggled biometric quick-login in settings.
   */
  isEnabledInSettings: (): boolean => {
    return kvStorage.getItem('auth.biometricsEnabled') === 'true';
  },

  /**
   * Stores preference of biometric quick-login toggling inside MMKV cache.
   */
  setEnabledInSettings: (enabled: boolean): void => {
    kvStorage.setItem('auth.biometricsEnabled', enabled ? 'true' : 'false');
  },
};
export default biometrics;
