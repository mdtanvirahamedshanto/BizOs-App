import React from 'react';
import { View, TouchableOpacity, ViewProps, GestureResponderEvent } from 'react-native';

export interface CardProps extends ViewProps {
  variant?: 'flat' | 'elevated' | 'clickable';
  onPress?: (event: GestureResponderEvent) => void;
  children: React.ReactNode;
}

export function Card({ variant = 'flat', onPress, children, className = '', ...rest }: CardProps) {
  const baseClass = 'bg-white rounded-2xl p-4 border border-slate-200/60';
  let variantClass = '';

  if (variant === 'elevated') {
    // Elevate border weight and depth
    variantClass = 'shadow-xs border-slate-200/80';
  } else if (variant === 'clickable') {
    variantClass = 'active:scale-99 active:bg-slate-50/60 border-slate-200';
  }

  if (variant === 'clickable' && onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        className={`${baseClass} ${variantClass} ${className}`}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={`${baseClass} ${variantClass} ${className}`} {...rest}>
      {children}
    </View>
  );
}
