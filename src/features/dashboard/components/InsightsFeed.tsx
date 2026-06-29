import React from 'react';
import { View, Text } from 'react-native';
import { Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { BusinessInsight } from '../hooks/use-dashboard-metrics';
import { useLanguageStore } from '@/utils/translation';

interface Props {
  insights: BusinessInsight[];
}

export function InsightsFeed({ insights }: Props) {
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  if (!insights || insights.length === 0) return null;

  return (
    <View className="mb-6 space-y-3">
      {insights.map((insight) => {
        const isSuccess = insight.type === 'success';
        const isAlert = insight.type === 'alert';
        
        return (
          <View 
            key={insight.id}
            className={`flex-row p-4 rounded-xl border ${
              isSuccess ? 'bg-emerald-50 border-emerald-100' :
              isAlert ? 'bg-rose-50 border-rose-100' :
              'bg-blue-50 border-blue-100'
            }`}
          >
            <View className="mr-3 mt-0.5">
              {isSuccess ? <TrendingUp size={16} color="#059669" /> : 
               isAlert ? <AlertTriangle size={16} color="#e11d48" /> : 
               <Lightbulb size={16} color="#2563eb" />}
            </View>
            <View className="flex-1">
              <Text className={`text-xs font-bold font-sans ${
                isSuccess ? 'text-emerald-900' :
                isAlert ? 'text-rose-900' :
                'text-blue-900'
              }`}>
                {isBn ? insight.banglaText : insight.englishText}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
