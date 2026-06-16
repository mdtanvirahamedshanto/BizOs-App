import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Button } from './Button';
import { t } from '@/utils/translation';

export interface StateVisualProps {
  state: 'loading' | 'error' | 'empty';
  message?: string;
  onRetry?: () => void;
}

export function StateVisual({ state, message, onRetry }: StateVisualProps) {
  const containerClass = 'flex-1 items-center justify-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 min-h-[250px]';
  const headerClass = 'text-base font-bold text-slate-800 font-sans mt-3 text-center';
  const textClass = 'text-xs font-semibold text-slate-400 text-center mt-1 mb-4 font-sans max-w-[200px]';

  if (state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center p-8 min-h-[250px]">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="text-xs font-bold text-slate-400 mt-3 font-sans">
          {message || t('loading')}
        </Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View className={containerClass}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Text className={headerClass}>{t('error')}</Text>
        <Text className={textClass}>
          {message || 'কোনো একটি সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।'}
        </Text>
        {onRetry && (
          <View className="w-36">
            <Button label={t('retry')} onPress={onRetry} variant="outline" />
          </View>
        )}
      </View>
    );
  }

  // Default: Empty State
  return (
    <View className={containerClass}>
      <Text style={{ fontSize: 36 }}>📂</Text>
      <Text className={headerClass}>{message || t('empty')}</Text>
      <Text className={textClass}>
        নতুন কোনো তথ্য যোগ করতে নিচের বাটনে চাপুন।
      </Text>
    </View>
  );
}
