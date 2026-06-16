import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { useLanguageStore } from '@/utils/translation';

export interface ButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'success' | 'destructive' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  // Base configurations
  const containerBaseClass =
    'h-12 w-full rounded-xl flex-row items-center justify-center px-4 active:scale-98 border';
  const textBaseClass = 'font-bold text-center tracking-tight';

  // Variant matching
  let containerVariantClass = '';
  let textVariantClass = '';
  let spinnerColor = '#ffffff';

  switch (variant) {
    case 'success':
      containerVariantClass = 'bg-success border-success active:bg-emerald-700';
      textVariantClass = 'text-white';
      spinnerColor = '#ffffff';
      break;
    case 'destructive':
      containerVariantClass = 'bg-destructive border-destructive active:bg-red-700';
      textVariantClass = 'text-white';
      spinnerColor = '#ffffff';
      break;
    case 'outline':
      containerVariantClass = 'bg-white border-slate-200 active:bg-slate-50';
      textVariantClass = 'text-slate-700';
      spinnerColor = '#475569';
      break;
    case 'primary':
    default:
      containerVariantClass = 'bg-primary border-primary active:bg-indigo-700';
      textVariantClass = 'text-white';
      spinnerColor = '#ffffff';
      break;
  }

  // Disabled configurations
  if (disabled || loading) {
    containerVariantClass = 'bg-slate-100 border-slate-100';
    textVariantClass = 'text-slate-400';
  }

  // Enforce Bangla scaling (1.1x)
  const textSizeClass = isBn ? 'text-[15px]' : 'text-sm';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      className={`${containerBaseClass} ${containerVariantClass}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text className={`${textBaseClass} ${textVariantClass} ${textSizeClass}`}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
