import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from '@/features/sync/sync.store';
import { useLanguageStore } from '@/utils/translation';

/**
 * App-wide connectivity + sync indicator. Renders a thin bar above the
 * navigation stack only when the device is offline, syncing, or has queued
 * offline transactions waiting to upload.
 */
export function GlobalStatusBanner() {
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const isBn = useLanguageStore((s) => s.language) === 'bn';

  // Nothing noteworthy → take up no space.
  if (isOnline && !isSyncing && pendingCount === 0) {
    return null;
  }

  let bg = 'bg-warning';
  let content: React.ReactNode;

  if (!isOnline) {
    bg = 'bg-warning';
    content = (
      <Text className="text-white text-[11px] font-extrabold font-sans">
        {isBn
          ? `⚠️ অফলাইন মোড${pendingCount > 0 ? ` • ${pendingCount} টি অপেক্ষমাণ` : ''}`
          : `⚠️ Offline${pendingCount > 0 ? ` • ${pendingCount} queued` : ''}`}
      </Text>
    );
  } else if (isSyncing) {
    bg = 'bg-primary';
    content = (
      <View className="flex-row items-center">
        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
        <Text className="text-white text-[11px] font-extrabold font-sans">
          {isBn ? 'সিঙ্ক হচ্ছে...' : 'Syncing...'}
        </Text>
      </View>
    );
  } else {
    // Online, not syncing, but still has pending items (between retries).
    bg = 'bg-primary';
    content = (
      <Text className="text-white text-[11px] font-extrabold font-sans">
        {isBn ? `${pendingCount} টি লেনদেন সিঙ্কের অপেক্ষায়` : `${pendingCount} transactions awaiting sync`}
      </Text>
    );
  }

  return (
    <View className={bg} style={{ paddingTop: insets.top }}>
      <View className="py-1.5 px-4 flex-row items-center justify-center">{content}</View>
    </View>
  );
}
