import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StateVisual } from '@/components/ui/StateVisual';
import { useLanguageStore } from '@/utils/translation';

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
  const isBn = useLanguageStore((s) => s.language) === 'bn';
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Timeframe selector */}
      <View className="flex-row p-3 bg-white border-b border-slate-200">
        {(['today', '7d', '30d'] as Timeframe[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            onPress={() => setTimeframe(tf)}
            activeOpacity={0.85}
            className={`flex-1 items-center py-2 rounded-lg mx-1 ${timeframe === tf ? 'bg-primary' : 'bg-slate-100'}`}
          >
            <Text className={`text-xs font-extrabold font-sans ${timeframe === tf ? 'text-white' : 'text-slate-500'}`}>
              {tfLabel[tf]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !data ? (
        <StateVisual state="loading" />
      ) : !data ? (
        <StateVisual state="error" onRetry={() => void load()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        >
          {/* KPI grid */}
          <View className="flex-row flex-wrap justify-between mb-4">
            <Card variant="elevated" className="w-[48%] mb-3 border-l-4 border-l-primary">
              <Text className="text-[10px] font-bold text-slate-400 uppercase font-sans">{isBn ? 'বিক্রি' : 'Sales'}</Text>
              <Text className="text-base font-black text-slate-800 font-sans mt-1">{money(data.salesCents)}</Text>
              <Text className="text-[9px] text-slate-400 font-sans mt-0.5">
                {data.txnCount} {isBn ? 'টি লেনদেন' : 'transactions'}
              </Text>
            </Card>
            <Card variant="elevated" className="w-[48%] mb-3 border-l-4 border-l-emerald-500">
              <Text className="text-[10px] font-bold text-slate-400 uppercase font-sans">{isBn ? 'আনুমানিক লাভ' : 'Est. Profit'}</Text>
              <Text className="text-base font-black text-emerald-600 font-sans mt-1">{money(data.profitCents)}</Text>
              <Text className="text-[9px] text-slate-400 font-sans mt-0.5">{isBn ? '~১৮% মার্জিন' : '~18% margin'}</Text>
            </Card>
            <Card variant="elevated" className="w-[48%] mb-3 border-l-4 border-l-rose-500">
              <Text className="text-[10px] font-bold text-slate-400 uppercase font-sans">{isBn ? 'খরচ' : 'Expenses'}</Text>
              <Text className="text-base font-black text-rose-600 font-sans mt-1">{money(data.expensesCents)}</Text>
            </Card>
            <Card variant="elevated" className="w-[48%] mb-3 border-l-4 border-l-amber-500">
              <Text className="text-[10px] font-bold text-slate-400 uppercase font-sans">{isBn ? 'নগদ জমা' : 'Cash In'}</Text>
              <Text className="text-base font-black text-amber-700 font-sans mt-1">{money(data.cashInCents)}</Text>
            </Card>
          </View>

          {/* Payment breakdown */}
          <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2 font-sans">
            {isBn ? 'পেমেন্ট বিভাজন' : 'Payment Breakdown'}
          </Text>
          <Card className="mb-4">
            {data.byStatus.length === 0 ? (
              <Text className="text-[11px] text-slate-400 font-sans text-center py-2">
                {isBn ? 'কোনো বিক্রি নেই' : 'No sales in this period'}
              </Text>
            ) : (
              data.byStatus.map((s, i) => (
                <View
                  key={s.paymentStatus}
                  className={`flex-row items-center justify-between py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <View className="flex-row items-center">
                    <Badge
                      label={statusLabel(s.paymentStatus)}
                      variant={s.paymentStatus === 'PAID' ? 'success' : s.paymentStatus === 'DUE' ? 'warning' : 'neutral'}
                    />
                    <Text className="text-[10px] text-slate-400 font-sans ml-2">
                      {s.cnt} {isBn ? 'টি' : 'txns'}
                    </Text>
                  </View>
                  <Text className="text-xs font-black text-slate-700 font-sans">{money(s.sum)}</Text>
                </View>
              ))
            )}
          </Card>

          {/* Top products */}
          <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2 font-sans">
            {isBn ? 'সর্বাধিক বিক্রিত পণ্য' : 'Top Products'}
          </Text>
          <Card className="mb-4">
            {data.topProducts.length === 0 ? (
              <Text className="text-[11px] text-slate-400 font-sans text-center py-2">
                {isBn ? 'কোনো তথ্য নেই' : 'No data'}
              </Text>
            ) : (
              data.topProducts.map((p, i) => (
                <View
                  key={`${p.name}-${i}`}
                  className={`flex-row items-center justify-between py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[11px] font-bold text-slate-700 font-sans" numberOfLines={1}>
                      {i + 1}. {p.name}
                    </Text>
                    <Text className="text-[9px] text-slate-400 font-sans mt-0.5">
                      {p.qty} {isBn ? 'টি বিক্রি' : 'units sold'}
                    </Text>
                  </View>
                  <Text className="text-xs font-black text-primary font-sans">{money(p.revenue)}</Text>
                </View>
              ))
            )}
          </Card>

          {/* Low stock */}
          <Text className="text-xs font-black text-slate-800 uppercase tracking-wide mb-2 font-sans">
            {isBn ? 'কম স্টক সতর্কতা' : 'Low Stock Alerts'}
          </Text>
          <Card>
            {data.lowStock.length === 0 ? (
              <Text className="text-[11px] text-slate-400 font-sans text-center py-2">
                {isBn ? 'সব পণ্যের পর্যাপ্ত স্টক আছে' : 'All products well stocked'}
              </Text>
            ) : (
              data.lowStock.map((p, i) => (
                <View
                  key={`${p.name}-${i}`}
                  className={`flex-row items-center justify-between py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <Text className="text-[11px] font-bold text-slate-700 font-sans flex-1 pr-3" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Badge label={`${p.stock} ${isBn ? 'টি' : 'left'}`} variant={p.stock <= 3 ? 'destructive' : 'warning'} />
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}
export default ReportsScreen;
