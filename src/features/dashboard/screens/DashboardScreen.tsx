import React from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDashboardMetrics } from '../hooks/use-dashboard-metrics';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StateVisual } from '@/components/ui/StateVisual';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from '@/features/sync/sync.store';
import { useAuthStore } from '@/store/auth.store';
import { AppTabParamList } from '@/navigation/root.navigator';

type DashboardScreenNavigationProp = BottomTabNavigationProp<AppTabParamList, 'Dashboard'>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
  const user = useAuthStore((s) => s.user);

  const { data: metrics, isLoading, error, refetch } = useDashboardMetrics(!isOnline);

  const formatCurrency = (cents: number) => `৳ ${(cents / 100).toFixed(2)}`;

  const handleShortcutPress = (screenName: keyof AppTabParamList) => {
    navigation.navigate(screenName);
  };

  if (isLoading) {
    return <StateVisual state="loading" />;
  }

  if (error || !metrics) {
    return <StateVisual state="error" onRetry={() => void refetch()} />;
  }

  const salesLabel = isBn ? 'আজকের বিক্রি (Sales)' : "Today's Sales";
  const profitLabel = isBn ? 'আজকের লাভ (Profit)' : "Today's Profit";
  const expenseLabel = isBn ? 'আজকের খরচ (Expenses)' : "Today's Expenses";
  const dueLabel = isBn ? 'বাকি খাতা (Total Due)' : 'Customer Debt';
  const stockLabel = isBn ? 'কম স্টক প্রোডাক্ট' : 'Low Stock Products';
  const shortcutTitle = isBn ? 'কুইক অ্যাকশন মেনু (Shortcuts)' : 'Quick Terminal Actions';

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      >
        {/* Greeting */}
        <View className="mb-4">
          <Text className="text-lg font-black text-slate-800 font-sans">
            {isBn ? 'স্বাগতম' : 'Welcome'}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Text className="text-[11px] text-slate-400 font-semibold font-sans mt-0.5">
            {isOnline
              ? isBn ? 'অনলাইন • সরাসরি ডেটা' : 'Online • Live data'
              : isBn ? 'অফলাইন • স্থানীয় ডেটা' : 'Offline • Local data'}
            {pendingSyncCount > 0 ? (isBn ? ` • ${pendingSyncCount} টি সিঙ্কের অপেক্ষায়` : ` • ${pendingSyncCount} pending`) : ''}
          </Text>
        </View>

        <LanguageSelector />

        {/* 1. Metrics Grid Summary */}
        <View className="flex-row flex-wrap justify-between mb-6">
          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-primary">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">{salesLabel}</Text>
            <Text className="text-lg font-black text-slate-800 font-sans mt-1">
              {formatCurrency(metrics.todaySalesCents)}
            </Text>
          </Card>

          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-emerald-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">{profitLabel}</Text>
            <Text className="text-lg font-black text-emerald-600 font-sans mt-1">
              {formatCurrency(metrics.todayProfitCents)}
            </Text>
          </Card>

          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-rose-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">{expenseLabel}</Text>
            <Text className="text-lg font-black text-rose-600 font-sans mt-1">
              {formatCurrency(metrics.todayExpensesCents)}
            </Text>
          </Card>

          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-amber-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">{dueLabel}</Text>
            <Text className="text-lg font-black text-amber-700 font-sans mt-1">
              {formatCurrency(metrics.totalDueCents)}
            </Text>
          </Card>

          <Card variant="flat" className="w-full flex-row items-center justify-between bg-white border border-slate-200">
            <View>
              <Text className="text-xs font-bold text-slate-700 font-sans">{stockLabel}</Text>
              <Text className="text-[10px] text-slate-450 font-sans mt-0.5">
                {isBn ? 'ইনভেন্টরিতে ১০ টির কম স্টক রয়েছে' : 'Inventory items below threshold (10 units)'}
              </Text>
            </View>
            <Badge
              label={`${metrics.lowStockCount} items`}
              variant={metrics.lowStockCount > 0 ? 'warning' : 'neutral'}
            />
          </Card>
        </View>

        {/* 2. Quick Shortcuts */}
        <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-3 font-sans">
          {shortcutTitle}
        </Text>

        <View className="space-y-3">
          <Card
            variant="clickable"
            onPress={() => handleShortcutPress('POS')}
            className="flex-row items-center justify-between h-14 bg-white border border-slate-200 mb-3"
          >
            <View className="flex-row items-center">
              <Text style={{ fontSize: 18, marginRight: 12 }}>🛒</Text>
              <View>
                <Text className="text-xs font-black text-slate-800 font-sans">
                  {isBn ? 'নতুন কাস্টমার সেল (New Sale)' : 'Create POS Receipt'}
                </Text>
                <Text className="text-[10px] text-slate-400 font-sans font-semibold">
                  {isBn ? 'টার্মিনাল থেকে ক্যাশ মেমো বানান' : 'Open barcode scanning register'}
                </Text>
              </View>
            </View>
            <Text className="text-xs font-bold text-slate-350">➔</Text>
          </Card>

          <Card
            variant="clickable"
            onPress={() => handleShortcutPress('Cashbook')}
            className="flex-row items-center justify-between h-14 bg-white border border-slate-200"
          >
            <View className="flex-row items-center">
              <Text style={{ fontSize: 18, marginRight: 12 }}>💵</Text>
              <View>
                <Text className="text-xs font-black text-slate-800 font-sans">
                  {isBn ? 'ড্রয়ার জমা ও খরচ (Cash Registry)' : 'Drawer Cash Operations'}
                </Text>
                <Text className="text-[10px] text-slate-400 font-sans font-semibold">
                  {isBn ? 'ক্যাশ ইন/আউট ও দিনের হিসাব সমাপ্তি' : 'Manual deposit, expense, and daily close'}
                </Text>
              </View>
            </View>
            <Text className="text-xs font-bold text-slate-350">➔</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
export default DashboardScreen;
