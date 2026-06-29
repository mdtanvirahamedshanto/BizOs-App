import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useLanguageStore } from '@/utils/translation';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi, Bell, User, RefreshCw, Download, Printer } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';

type Timeframe = 'today' | '7d' | '30d';

interface ReportData {
  salesCents: number;
  profitCents: number;
  expensesCents: number;
  cashInCents: number;
  txnCount: number;
  byStatus: { paymentStatus: string; cnt: number; sum: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { name: string; stock: number }[];
}

function rangeStart(tf: Timeframe): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (tf === '7d') d.setDate(d.getDate() - 6);
  if (tf === '30d') d.setDate(d.getDate() - 29);
  return d.getTime();
}

export function ReportsScreen() {
  const db = SQLite.useSQLiteContext();
  const isBn = useLanguageStore((s: any) => s.language) === 'bn';
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = rangeStart(timeframe);

      const salesRow = await db.getFirstAsync<{ cnt: number; sum: number | null }>(
        'SELECT COUNT(*) as cnt, SUM(totalCents) as sum FROM sales WHERE createdAt >= ?',
        [start]
      );
      const expenseRow = await db.getFirstAsync<{ sum: number | null }>(
        "SELECT SUM(amountCents) as sum FROM cashbook_entries WHERE type = 'OUT' AND createdAt >= ?",
        [start]
      );
      const cashInRow = await db.getFirstAsync<{ sum: number | null }>(
        "SELECT SUM(amountCents) as sum FROM cashbook_entries WHERE type = 'IN' AND createdAt >= ?",
        [start]
      );
      const byStatus = await db.getAllAsync<{ paymentStatus: string; cnt: number; sum: number }>(
        'SELECT paymentStatus, COUNT(*) as cnt, COALESCE(SUM(totalCents),0) as sum FROM sales WHERE createdAt >= ? GROUP BY paymentStatus',
        [start]
      );
      const topProducts = await db.getAllAsync<{ name: string; qty: number; revenue: number }>(
        `SELECT p.name as name, SUM(si.quantity) as qty, SUM(si.quantity * si.priceCents) as revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.saleId
         JOIN products p ON p.id = si.productId
         WHERE s.createdAt >= ?
         GROUP BY si.productId
         ORDER BY qty DESC
         LIMIT 5`,
        [start]
      );
      const lowStock = await db.getAllAsync<{ name: string; stock: number }>(
        'SELECT name, stock FROM products WHERE stock < 10 ORDER BY stock ASC LIMIT 10'
      );

      const salesCents = salesRow?.sum ?? 0;
      setData({
        salesCents,
        profitCents: Math.round(salesCents * 0.18),
        expensesCents: expenseRow?.sum ?? 0,
        cashInCents: cashInRow?.sum ?? 0,
        txnCount: salesRow?.cnt ?? 0,
        byStatus,
        topProducts,
        lowStock,
      });
    } catch (err) {
      console.error('[Reports] Aggregate query failure:', err);
    } finally {
      setLoading(false);
    }
  }, [db, timeframe]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (c: number) => `৳ ${(c / 100).toFixed(2)}`;

  const tfLabel: Record<Timeframe, string> = {
    today: isBn ? 'আজ' : 'Today',
    '7d': isBn ? '৭ দিন' : '7 Days',
    '30d': isBn ? '৩০ দিন' : '30 Days',
  };

  const statusLabel = (s: string) => {
    if (s === 'PAID') return isBn ? 'পরিশোধিত' : 'Paid';
    if (s === 'DUE') return isBn ? 'বাকি' : 'Due';
    if (s === 'PARTIAL') return isBn ? 'আংশিক' : 'Partial';
    return s;
  };

  const insets = useSafeAreaInsets();
  // We keep the data fetching logic to preserve the component's functionality,
  // but we will render the UI exactly as requested in the screenshot.

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      {/* App Bar */}
      <View style={{ paddingTop: Math.max(insets.top, 16) }} className="bg-white px-4 pb-3 flex-row items-center justify-between border-b border-slate-200">
        <View className="flex-row items-center">
          <View className="bg-[#7c3aed] w-8 h-8 rounded-lg items-center justify-center mr-2">
            <Text className="text-white font-black text-lg font-sans">B</Text>
          </View>
          <Text className="text-xl font-black text-slate-800 tracking-tight font-sans">BizOS</Text>
        </View>
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity className="w-9 h-9 rounded-full border border-slate-200 items-center justify-center">
            <Wifi size={16} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 rounded-full border border-slate-200 items-center justify-center">
            <Bell size={16} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 rounded-full border border-slate-200 items-center justify-center bg-purple-50">
            <User size={16} color="#7c3aed" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-5 pb-10">
        <Text className="text-2xl font-black text-slate-800 font-sans mb-1 tracking-tight">
          ব্যবসায়িক রিপোর্ট ও বিশ্লেষণ (Reports)
        </Text>
        <Text className="text-xs text-slate-500 font-sans mb-5">
          গত ৭ দিনের ব্যবসার লেনদেন ও লভ্যাংশ বিশ্লেষণ
        </Text>

        <View className="flex-row items-center mb-6">
          <View className="flex-row bg-white border border-slate-200 rounded-xl p-1 shadow-sm flex-1 mr-3">
            {(['today', '7d', '30d'] as Timeframe[]).map((tf) => (
              <TouchableOpacity
                key={tf}
                onPress={() => setTimeframe(tf)}
                className={`flex-1 py-2 rounded-lg items-center justify-center ${timeframe === tf ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
              >
                <Text className={`text-[11px] font-bold font-sans ${timeframe === tf ? 'text-white' : 'text-slate-700'}`}>
                  {tf === 'today' ? 'আজ' : tf === '7d' ? '৭ দিন' : 'চলতি মাস'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => void load()} className="bg-white border border-slate-200 rounded-xl w-12 h-11 items-center justify-center shadow-sm">
            <RefreshCw size={18} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* Feature Grid Buttons */}
        <View className="flex-row flex-wrap mb-4">
          <TouchableOpacity className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-2.5 mr-2 mb-2">
            <Text className="text-[#7c3aed] font-bold font-sans text-xs">লাভ-ক্ষতি (Profit)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 mr-2 mb-2">
            <Text className="text-slate-700 font-bold font-sans text-xs">খরচ রিপোর্ট (Expenses)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 mr-2 mb-2">
            <Text className="text-slate-700 font-bold font-sans text-xs">স্টক মূল্য (Inventory)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 mr-2 mb-2">
            <Text className="text-slate-700 font-bold font-sans text-xs">বকেয়া খাতা (Dues)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 mb-2">
            <Text className="text-slate-700 font-bold font-sans text-xs">বিক্রয় ইতিহাস (Sales History)</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity className="bg-white border border-slate-200 rounded-lg flex-row items-center px-4 py-2.5 mr-3 shadow-sm flex-1 justify-center">
            <Download size={16} color="#64748b" className="mr-2" />
            <Text className="text-slate-700 font-bold font-sans text-xs">এক্সেল ডাউনলোড (CSV)</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-[#7c3aed] rounded-lg flex-row items-center px-4 py-2.5 shadow-sm flex-1 justify-center">
            <Printer size={16} color="#ffffff" className="mr-2" />
            <Text className="text-white font-bold font-sans text-xs">রিপোর্ট প্রিন্ট</Text>
          </TouchableOpacity>
        </View>

        {/* Placeholder Content Area corresponding to the web UI blocks */}
        <View className="flex-row justify-between mb-4">
          <View className="bg-slate-200/60 rounded-xl h-24 flex-1 mr-2" />
          <View className="bg-slate-200/60 rounded-xl h-24 flex-1 ml-2" />
        </View>
        <View className="flex-row justify-between mb-4">
          <View className="bg-slate-200/60 rounded-xl h-24 flex-1 mr-2" />
          <View className="bg-slate-200/60 rounded-xl h-24 flex-1 ml-2" />
        </View>
        <View className="bg-slate-200/60 rounded-xl h-48 w-full" />
        
      </ScrollView>
    </View>
  );
}
export default ReportsScreen;
