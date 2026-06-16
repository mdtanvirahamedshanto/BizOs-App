import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguageStore } from '@/utils/translation';

/**
 * Interface Component allowing cashiers and owners to switch languages on-the-fly.
 * Automatically saves preferences inside persistent MMKV storage.
 */
export function LanguageSelector() {
  const { language, setLanguage } = useLanguageStore();

  return (
    <View className="flex-row items-center justify-between p-4 bg-white border border-slate-200/60 rounded-2xl mb-4">
      <Text className="text-xs font-bold text-slate-700 font-sans">ভাষা / Language</Text>
      <View className="flex-row rounded-lg border border-slate-200 p-1 bg-slate-50/50">
        
        {/* Toggle Bangla */}
        <TouchableOpacity
          onPress={() => setLanguage('bn')}
          activeOpacity={0.8}
          style={{ paddingVertical: 4, paddingHorizontal: 12 }}
          className={`rounded-md ${language === 'bn' ? 'bg-primary' : 'bg-transparent'}`}
        >
          <Text className={`text-[10px] font-extrabold font-sans ${language === 'bn' ? 'text-white' : 'text-slate-600'}`}>
            বাংলা
          </Text>
        </TouchableOpacity>

        {/* Toggle English */}
        <TouchableOpacity
          onPress={() => setLanguage('en')}
          activeOpacity={0.8}
          style={{ paddingVertical: 4, paddingHorizontal: 12 }}
          className={`rounded-md ${language === 'en' ? 'bg-primary' : 'bg-transparent'}`}
        >
          <Text className={`text-[10px] font-extrabold font-sans ${language === 'en' ? 'text-white' : 'text-slate-600'}`}>
            English
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}
