import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useDashboardMetrics } from '../hooks/use-dashboard-metrics';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OfflineNotice } from '@/components/ui/OfflineNotice';
import { StateVisual } from '@/components/ui/StateVisual';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useLanguageStore, t } from '@/utils/translation';
import { AppTabParamList } from '@/navigation/root.navigator';

type DashboardScreenNavigationProp = BottomTabNavigationProp<AppTabParamList, 'Dashboard'>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const db = SQLite.useSQLiteContext();
  // State flags for mock testing. In a full device integration, NetInfo determines offline state.
  const [isOffline, setIsOffline] = React.useState(true);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);

  const { data: metrics, isLoading, error, refetch } = useDashboardMetrics(isOffline);

  const loadPendingCount = React.useCallback(async () => {
    try {
      const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox');
      setPendingSyncCount(row?.count ?? 0);
    } catch (err) {
      console.error('[Dashboard] Outbox count error:', err);
    }
  }, [db]);

  React.useEffect(() => {
    void loadPendingCount();
  }, [loadPendingCount, metrics]);

  const formatCurrency = (cents: number) => {
    const taka = (cents / 100).toFixed(2);
    return isBn ? `৳ ${taka}` : `৳ ${taka}`;
  };

  const handleShortcutPress = (screenName: keyof AppTabParamList) => {
    navigation.navigate(screenName);
  };

  if (isLoading) {
    return <StateVisual state="loading" />;
  }

  if (error || !metrics) {
    return <StateVisual state="error" onRetry={() => void refetch()} />;
  }

  // Define bilingual labels
  const salesLabel = isBn ? 'আজকের বিক্রি (Sales)' : 'Today\'s Sales';
  const profitLabel = isBn ? 'আজকের লাভ (Profit)' : 'Today\'s Profit';
  const expenseLabel = isBn ? 'আজকের খরচ (Expenses)' : 'Today\'s Expenses';
  const dueLabel = isBn ? 'বাকি খাতা (Total Due)' : 'Customer Debt';
  const stockLabel = isBn ? 'কম স্টক প্রোডাক্ট' : 'Low Stock Products';
  const shortcutTitle = isBn ? 'কুইক অ্যাকশন মেনু (Shortcuts)' : 'Quick Terminal Actions';

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      >
        {/* Language Toggler */}
        <LanguageSelector />

        {/* Network Toggle Emulator for testing demo */}
        <TouchableOpacity
          onPress={() => {
            setIsOffline((prev) => !prev);
            setPendingSyncCount((prev) => (prev > 0 ? 0 : 3));
          }}
          activeOpacity={0.8}
          className="p-3 bg-slate-100 border border-slate-200 rounded-xl mb-4 items-center"
        >
          <Text className="text-[10px] font-black text-slate-500 font-sans">
            [DEMO MODE] TOGGLE NETWORK: {isOffline ? 'OFFLINE (SQLite)' : 'ONLINE (API)'}
          </Text>
        </TouchableOpacity>

        {/* 1. Metrics Grid Summary */}
        <View className="flex-row flex-wrap justify-between mb-6">
          
          {/* Today's Sales Card */}
          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-primary">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">
              {salesLabel}
            </Text>
            <Text className="text-lg font-black text-slate-800 font-sans mt-1">
              {formatCurrency(metrics.todaySalesCents)}
            </Text>
          </Card>

          {/* Profit Card */}
          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-emerald-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">
              {profitLabel}
            </Text>
            <Text className="text-lg font-black text-emerald-600 font-sans mt-1">
              {formatCurrency(metrics.todayProfitCents)}
            </Text>
          </Card>

          {/* Expenses Card */}
          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-rose-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">
              {expenseLabel}
            </Text>
            <Text className="text-lg font-black text-rose-600 font-sans mt-1">
              {formatCurrency(metrics.todayExpensesCents)}
            </Text>
          </Card>

          {/* Due/Debt Card */}
          <Card variant="elevated" className="w-[48%] mb-4 border-l-4 border-l-amber-500">
            <Text className="text-[10px] font-bold text-slate-400 font-sans uppercase">
              {dueLabel}
            </Text>
            <Text className="text-lg font-black text-amber-700 font-sans mt-1">
              {formatCurrency(metrics.totalDueCents)}
            </Text>
          </Card>

          {/* Low Stock Alert banner */}
          <Card variant="flat" className="w-full flex-row items-center justify-between bg-white border border-slate-200">
            <View>
              <Text className="text-xs font-bold text-slate-700 font-sans">
                {stockLabel}
              </Text>
              <Text className="text-[10px] text-slate-450 font-sans mt-0.5">
                {isBn ? 'ইনভেন্টরিতে ১০ টির কম স্টক রয়েছে' : 'Inventory items below threshold (10 units)'}
              </Text>
            </View>
            <Badge
              label={`${metrics.lowStockCount} items`}
              variant={metrics.lowStockCount > 0 ? 'warning' : 'neutral'}
            />
          </Card>

        </View>

        {/* 2. Natural Thumb-Zone Quick Shortcuts */}
        <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-3 font-sans">
          {shortcutTitle}
        </Text>

        <View className="space-y-3">
          {/* Jump to POS Terminal */}
          <Card
            variant="clickable"
            onPress={() => handleShortcutPress('POS')}
            className="flex-row items-center justify-between h-14 bg-white border border-slate-200"
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

          {/* Jump to Cashbook Operations */}
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

      {/* Sticky Bottom Sync Status Notice */}
      <OfflineNotice isOffline={isOffline} pendingCount={pendingSyncCount} isSyncing={isOffline} />
    </View>
  );
}
export default DashboardScreen;
