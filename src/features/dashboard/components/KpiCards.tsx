import React from 'react';
import { View, Text } from 'react-native';
import { ShoppingBag, CreditCard, BookOpen, PiggyBank, Boxes, TrendingUp, TrendingDown } from 'lucide-react-native';
import { DashboardMetrics } from '../hooks/use-dashboard-metrics';
import { useLanguageStore } from '@/utils/translation';

interface KpiCardsProps {
  metrics: DashboardMetrics;
  timeframe: 'today' | 'seven_days' | 'month';
}

export function formatTaka(amount: number): string {
  const formattedEn = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `৳${formattedEn}`;
}

export function KpiCards({ metrics, timeframe }: KpiCardsProps) {
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const getLabel = (type: 'sales' | 'expenses' | 'profit') => {
    switch (timeframe) {
      case 'seven_days':
        return {
          sales: { bn: '৭ দিনের বিক্রি', en: "7 Days' Sales" },
          expenses: { bn: 'মোট খরচ', en: 'Total Expenses' },
          profit: { bn: '৭ দিনের লাভ', en: "7 Days' Profit" }
        }[type];
      case 'month':
        return {
          sales: { bn: 'চলতি মাসের বিক্রি', en: "This Month's Sales" },
          expenses: { bn: 'মোট খরচ', en: 'Total Expenses' },
          profit: { bn: 'চলতি মাসের লাভ', en: "This Month's Profit" }
        }[type];
      default:
        return {
          sales: { bn: 'আজকের বিক্রি', en: "Today's Sales" },
          expenses: { bn: 'মোট খরচ', en: 'Total Expenses' },
          profit: { bn: 'আজকের লাভ', en: "Today's Profit" }
        }[type];
    }
  };

  const cards = [
    {
      title: isBn ? getLabel('sales').bn : getLabel('sales').en,
      sub: isBn ? getLabel('sales').en : getLabel('sales').bn,
      value: formatTaka(metrics.todaySalesCents / 100),
      growth: metrics.salesGrowthPercent,
      icon: ShoppingBag,
      iconColor: '#4f46e5', // indigo-600
      iconBg: 'bg-indigo-50 border-indigo-100',
    },
    {
      title: isBn ? 'মোট বাকি (বকেয়া)' : 'Total Due (Bokeya)',
      sub: 'Total Due',
      value: formatTaka(metrics.totalDueCents / 100),
      growth: metrics.dueGrowthPercent,
      icon: CreditCard,
      iconColor: '#dc2626', // red-600
      iconBg: 'bg-red-50 border-red-100',
    },
    {
      title: isBn ? getLabel('expenses').bn : getLabel('expenses').en,
      sub: isBn ? getLabel('expenses').en : getLabel('expenses').bn,
      value: formatTaka(metrics.todayExpensesCents / 100),
      growth: metrics.expensesGrowthPercent,
      icon: BookOpen,
      iconColor: '#d97706', // amber-600
      iconBg: 'bg-amber-50 border-amber-100',
    },
    {
      title: isBn ? getLabel('profit').bn : getLabel('profit').en,
      sub: isBn ? getLabel('profit').en : getLabel('profit').bn,
      value: formatTaka(metrics.todayProfitCents / 100),
      growth: metrics.profitGrowthPercent,
      icon: PiggyBank,
      iconColor: '#059669', // emerald-600
      iconBg: 'bg-emerald-50 border-emerald-100',
    },
    {
      title: isBn ? 'স্টক প্রোডাক্টের মূল্য' : 'Inventory Value',
      sub: 'Inventory Value',
      value: formatTaka(metrics.inventoryValueCents / 100),
      growth: metrics.inventoryGrowthPercent,
      icon: Boxes,
      iconColor: '#475569', // slate-600
      iconBg: 'bg-slate-50 border-slate-100',
    },
  ];

  return (
    <View className="flex-row flex-wrap justify-between mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isPositive = card.growth >= 0;
        const isFullWidth = idx === 4;

        return (
          <View
            key={idx}
            className={`bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm mb-4 ${
              isFullWidth ? 'w-full' : 'w-[48%]'
            }`}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-xs font-bold text-slate-500 mb-0.5 font-sans" numberOfLines={1}>
                  {card.title}
                </Text>
                <Text className="text-[9px] text-slate-400 font-medium font-sans mb-3" numberOfLines={1}>
                  {card.sub}
                </Text>
              </View>
              <View className={`h-8 w-8 rounded-lg border items-center justify-center ${card.iconBg}`}>
                <Icon size={16} color={card.iconColor} />
              </View>
            </View>

            <View className="mt-1">
              <Text className="text-xl font-black text-slate-800 tracking-tight font-sans mb-1.5">
                {card.value}
              </Text>

              <View className="flex-row items-center">
                <View className={`flex-row items-center rounded-full px-1.5 py-0.5 mr-1.5 ${
                  isPositive ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  {isPositive ? (
                    <TrendingUp size={10} color="#10b981" />
                  ) : (
                    <TrendingDown size={10} color="#ef4444" />
                  )}
                  <Text className={`text-[10px] font-bold font-sans ml-0.5 ${
                    isPositive ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {Math.abs(card.growth)}%
                  </Text>
                </View>
                <Text className="text-[9px] text-slate-400 font-medium font-sans">
                  {isBn ? 'গতদিন তুলনায়' : 'vs yesterday'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
