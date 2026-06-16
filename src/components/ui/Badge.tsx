import React from 'react';
import { View, Text } from 'react-native';
import { useLanguageStore } from '@/utils/translation';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'destructive' | 'warning' | 'neutral';
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  let bgClass = '';
  let textClass = '';

  switch (variant) {
    case 'primary':
      bgClass = 'bg-primary/10 border-primary/20';
      textClass = 'text-primary-700';
      break;
    case 'success':
      bgClass = 'bg-success/10 border-success/20';
      textClass = 'text-emerald-700';
      break;
    case 'destructive':
      bgClass = 'bg-destructive/10 border-destructive/20';
      textClass = 'text-rose-700';
      break;
    case 'warning':
      bgClass = 'bg-warning/10 border-warning/20';
      textClass = 'text-amber-700';
      break;
    case 'neutral':
    default:
      bgClass = 'bg-slate-150 border-slate-200';
      textClass = 'text-slate-600';
      break;
  }

  const sizeClass = isBn ? 'text-[10px]' : 'text-[9px]';

  return (
    <View className={`px-2 py-0.5 rounded-md border self-start ${bgClass}`}>
      <Text className={`font-extrabold uppercase font-sans ${textClass} ${sizeClass}`}>
        {label}
      </Text>
    </View>
  );
}
