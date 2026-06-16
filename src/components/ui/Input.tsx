import React from 'react';
import { View, TextInput, Text, TouchableOpacity, TextInputProps } from 'react-native';
import { useLanguageStore } from '@/utils/translation';

export interface InputProps extends Omit<TextInputProps, 'placeholderTextColor'> {
  label?: string;
  error?: string;
  onClear?: () => void;
  prefix?: string; // e.g. '৳' or phone code
}

export function Input({
  label,
  error,
  onClear,
  prefix,
  value,
  onChangeText,
  ...rest
}: InputProps) {
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const labelSizeClass = isBn ? 'text-[12px]' : 'text-xs';
  const inputSizeClass = isBn ? 'text-[15px]' : 'text-sm';
  const errorSizeClass = isBn ? 'text-[11px]' : 'text-[10px]';

  return (
    <View className="w-full space-y-1.5 mb-4">
      {label && (
        <Text className={`${labelSizeClass} font-bold text-slate-700 font-sans`}>
          {label}
        </Text>
      )}

      <View
        className={`h-12 w-full rounded-xl border flex-row items-center px-3 bg-white ${
          error ? 'border-destructive' : 'border-slate-200 focus:border-primary'
        }`}
      >
        {prefix && (
          <Text className="text-sm font-extrabold text-slate-400 mr-2 font-sans">
            {prefix}
          </Text>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#94a3b8" // Slate-400
          className={`flex-1 h-full font-semibold text-slate-800 ${inputSizeClass}`}
          {...rest}
        />

        {value && onClear && (
          <TouchableOpacity
            onPress={onClear}
            activeOpacity={0.7}
            className="h-8 w-8 items-center justify-center rounded-full bg-slate-100/60 ml-2"
          >
            <Text className="text-[10px] font-black text-slate-500 font-sans">✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text className={`${errorSizeClass} font-bold text-destructive font-sans mt-1`}>
          {error}
        </Text>
      )}
    </View>
  );
}
