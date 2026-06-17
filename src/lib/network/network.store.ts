import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  /** True once the very first NetInfo result has arrived. */
  isHydrated: boolean;
  /** Device has an active network interface (wifi/cellular). */
  isConnected: boolean;
  /** Internet is actually reachable (null = unknown/not yet probed). */
  isInternetReachable: boolean | null;
  /** Convenience flag used by the rest of the app. */
  isOnline: boolean;
  setStatus: (isConnected: boolean, isInternetReachable: boolean | null) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isHydrated: false,
  isConnected: true,
  isInternetReachable: true,
  isOnline: true,
  setStatus: (isConnected, isInternetReachable) => {
    // Treat "unknown reachability" (null) as online to avoid false offline flags.
    const isOnline = isConnected && isInternetReachable !== false;
    set({ isHydrated: true, isConnected, isInternetReachable, isOnline });
  },
}));

/**
 * Subscribes to OS connectivity changes. Returns an unsubscribe function.
 * Call once at app bootstrap.
 */
export function initNetworkListener(): () => void {
  // Prime the store with the current state immediately.
  void NetInfo.fetch().then((state) => {
    useNetworkStore.getState().setStatus(!!state.isConnected, state.isInternetReachable);
  });

  return NetInfo.addEventListener((state) => {
    useNetworkStore.getState().setStatus(!!state.isConnected, state.isInternetReachable);
  });
}

/** Imperative read of the current online status (for non-React modules). */
export function getIsOnline(): boolean {
  return useNetworkStore.getState().isOnline;
}
