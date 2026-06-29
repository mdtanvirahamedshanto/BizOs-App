import React, { useState } from 'react';
import { ScrollView, View, Text, RefreshControl, TouchableOpacity } from 'react-native';
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
import { SalesChart } from '../components/SalesChart';
import { KpiCards } from '../components/KpiCards';
import { RecentTransactions } from '../components/RecentTransactions';
import { InsightsFeed } from '../components/InsightsFeed';
import { Bell, Wifi, WifiOff } from 'lucide-react-native';

type DashboardScreenNavigationProp = BottomTabNavigationProp<AppTabParamList, 'Dashboard'>;
type Timeframe = 'today' | 'seven_days' | 'month';

export function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const isOnline = useNetworkStore((s) => s.isOnline);
  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
  const user = useAuthStore((s) => s.user);

  const [timeframe, setTimeframe] = useState<Timeframe>('today');

  const { data: metrics, isLoading, error, refetch, isFetching } = useDashboardMetrics(!isOnline, timeframe);

  const formatCurrency = (cents: number) => `৳ ${(cents / 100).toLocaleString('bn-BD')}`;

  const handleShortcutPress = (screenName: keyof AppTabParamList) => {
    navigation.navigate(screenName);
  };

  const salesLabel = isBn ? 'বিক্রি (Sales)' : "Sales";
  const profitLabel = isBn ? 'লাভ (Profit)' : "Profit";
  const expenseLabel = isBn ? 'খরচ (Expenses)' : "Expenses";
  const dueLabel = isBn ? 'বাকি খাতা (Total Due)' : 'Customer Debt';
  const stockLabel = isBn ? 'কম স্টক প্রোডাক্ট' : 'Low Stock Products';
  const shortcutTitle = isBn ? 'কুইক অ্যাকশন মেনু (Shortcuts)' : 'Quick Terminal Actions';

  const getSlogans = () => {
    switch (timeframe) {
      case 'seven_days':
        return isBn ? 'গত ৭ দিনের ব্যবসার হিসাব' : 'Business summary for last 7 days';
      case 'month':
        return isBn ? 'চলতি মাসের ব্যবসার হিসাব' : 'Business summary for this month';
      default:
        return isBn ? 'আজকের দিনের ব্যবসার সামগ্রিক হিসাব' : 'Overall business summary for today';
    }
  };

  if (isLoading && !metrics) {
    return <StateVisual state="loading" />;
  }

  if (error || !metrics) {
    return <StateVisual state="error" onRetry={() => void refetch()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Custom TopBar for Mobile App matching Web App */}
      <View className="flex-row items-center justify-between px-4 pt-safe pb-4 bg-white border-b border-slate-100">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 rounded-lg bg-primary items-center justify-center">
            <Text className="text-white font-bold text-lg font-sans">B</Text>
          </View>
          <Text className="text-xl font-black text-slate-800 font-sans tracking-tight">BizOS</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className={`h-8 w-8 rounded-full border items-center justify-center ${isOnline ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            {isOnline ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#f43f5e" />}
          </View>
          <View className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 items-center justify-center">
            <Bell size={14} color="#64748b" />
          </View>
          <View className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 items-center justify-center">
            <Text className="text-primary font-bold text-xs uppercase font-sans">
              {user?.name ? user.name.charAt(0) : 'U'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isLoading || isFetching} onRefresh={() => void refetch()} />}
      >
        {/* Greeting & Title matching Web App */}
        <View className="mb-4">
          <Text className="text-xl font-black text-slate-800 font-sans tracking-tight">
            {isBn ? 'ব্যবসা ড্যাশবোর্ড' : 'Business Dashboard'}
          </Text>
          <Text className="text-xs text-slate-500 font-semibold font-sans mt-0.5">
            {getSlogans()}
            {pendingSyncCount > 0 ? (isBn ? ` • ${pendingSyncCount} টি সিঙ্কের অপেক্ষায়` : ` • ${pendingSyncCount} pending syncs`) : ''}
          </Text>
        </View>

        {/* Timeframe Filters Row */}
        <View className="flex-row items-center bg-white border border-slate-200 rounded-lg p-1 mb-5">
          {(['today', 'seven_days', 'month'] as Timeframe[]).map((tf) => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              className={`flex-1 py-2 rounded-md items-center justify-center ${timeframe === tf ? 'bg-primary' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-bold font-sans ${timeframe === tf ? 'text-white' : 'text-slate-600'}`}>
                {tf === 'today' ? (isBn ? 'আজ' : 'Today') : tf === 'seven_days' ? (isBn ? '৭ দিন' : '7 Days') : (isBn ? 'মাস' : 'Month')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. Metrics Grid Summary */}
        {metrics && (
          <KpiCards metrics={metrics} timeframe={timeframe} />
        )}

        {/* Business Insights */}
        {metrics.insights && metrics.insights.length > 0 && (
          <InsightsFeed insights={metrics.insights} />
        )}

        {/* 2. Sales Chart from Web App */}
        {metrics.chartData && metrics.chartData.length > 0 && (
          <SalesChart data={metrics.chartData} />
        )}

        {/* Recent Transactions */}
        {metrics.recentTransactions && metrics.recentTransactions.length > 0 && (
          <RecentTransactions transactions={metrics.recentTransactions} />
        )}

        {/* 3. Quick Shortcuts */}
        <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-3 font-sans mt-2">
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
