import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { t } from '@/utils/translation';

export interface OfflineNoticeProps {
  isOffline: boolean;
  pendingCount?: number;
  isSyncing?: boolean;
}

export function OfflineNotice({
  isOffline,
  pendingCount = 0,
  isSyncing = false,
}: OfflineNoticeProps) {
  // If online and all data is synced, hide banner
  if (!isOffline && pendingCount === 0) {
    return null;
  }

  // A. Offline Active but nothing pending in sync outbox queue
  if (isOffline && pendingCount === 0) {
    return (
      <View className="bg-warning w-full py-2.5 px-4 flex-row items-center justify-center border-t border-amber-600/30">
        <Text className="text-white text-xs font-extrabold font-sans">
          ⚠️ {t('offline')}
        </Text>
      </View>
    );
  }

  // B. Syncing background queue
  return (
    <View className="bg-primary-600 w-full py-2.5 px-4 flex-row items-center justify-between border-t border-indigo-700">
      <View className="flex-row items-center">
        {isSyncing ? (
          <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
        ) : (
          <Text style={{ marginRight: 8 }}>🔄</Text>
        )}
        <Text className="text-white text-xs font-extrabold font-sans">
          {isSyncing ? t('syncing') : `${t('offline')} (${pendingCount} queued)`}
        </Text>
      </View>
      <View className="bg-white/20 px-2 py-0.5 rounded-full">
        <Text className="text-white text-[10px] font-black font-sans">
          {pendingCount}
        </Text>
      </View>
    </View>
  );
}
