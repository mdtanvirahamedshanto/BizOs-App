import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ShoppingBag, Plus, Truck, Search, ChevronDown, FileText, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { purchasesApi, Purchase } from '@/lib/api/modules/purchases.api';

export function PurchasesScreen() {
  const db = SQLite.useSQLiteContext();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPurchases = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<Purchase>(
        'SELECT * FROM purchases ORDER BY createdAt DESC LIMIT 50'
      );
      setPurchases(rows);
    } catch (err) {
      console.error('[Purchases] SQLite fetch error:', err);
    }
  }, [db]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        // Sync purchases logic would go here
        await loadPurchases();
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, loadPurchases]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Main Header */}
        <View className="mb-6">
          <Text className="text-2xl font-black text-slate-800 font-sans tracking-tight">
            {isBn ? 'ক্রয় ব্যবস্থাপনা' : 'Purchase Management'}
          </Text>
          <Text className="text-xs font-bold text-slate-500 font-sans mt-1">
            {isBn ? 'সরবরাহকারী থেকে পণ্য ক্রয়, স্টক গ্রহণ ও পেমেন্ট ট্র্যাকিং' : 'Supplier procurement & stock receiving'}
          </Text>
        </View>

        {/* Purchase Orders Card */}
        <View className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
          <View className="flex-row items-center mb-1">
            <Truck color="#7c3aed" size={20} />
            <Text className="text-base font-black text-slate-800 font-sans ml-2">
              {isBn ? 'ক্রয় অর্ডার (Purchase Orders)' : 'Purchase Orders'}
            </Text>
          </View>
          <Text className="text-[10px] font-bold text-slate-400 font-sans mb-5">
            Supplier procurement & stock receiving
          </Text>

          <TouchableOpacity activeOpacity={0.8} className="bg-[#7c3aed] py-3 rounded-lg flex-row items-center justify-center w-40 mb-5 shadow-sm shadow-purple-200">
            <Plus color="#ffffff" size={16} />
            <Text className="text-white text-xs font-bold font-sans ml-1">
              {isBn ? 'নতুন ক্রয় অর্ডার' : 'New Purchase Order'}
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center bg-white border border-slate-200 rounded-lg px-3 h-12 mb-3">
            <Search color="#94a3b8" size={18} />
            <Text className="ml-2 text-xs font-sans text-slate-400 flex-1">
              {isBn ? 'PO নম্বর বা সরবরাহকারী খুঁজুন...' : 'Search PO or supplier...'}
            </Text>
          </View>

          <View className="flex-row items-center bg-white border border-slate-200 rounded-lg px-3 h-12 mb-6 justify-between">
            <Text className="text-xs font-sans text-slate-800">
              {isBn ? 'সব স্ট্যাটাস' : 'All Status'}
            </Text>
            <ChevronDown color="#94a3b8" size={18} />
          </View>

          {purchases.length === 0 ? (
            <View className="border border-dashed border-slate-300 rounded-xl items-center justify-center py-12 mb-6 bg-slate-50/50">
              <FileText color="#cbd5e1" size={32} className="mb-3" />
              <Text className="text-xs font-bold text-slate-500 font-sans">
                {isBn ? 'কোনো ক্রয় অর্ডার পাওয়া যায়নি।' : 'No purchase orders found.'}
              </Text>
            </View>
          ) : (
            <View className="mb-6">
              {purchases.map((purchase) => (
                <View key={purchase.id} className="border-b border-slate-100 py-3 flex-row justify-between items-center">
                  <View>
                    <Text className="text-sm font-bold text-slate-800 font-sans">{purchase.referenceNumber}</Text>
                    <Text className="text-[10px] text-slate-500 font-sans">{new Date(purchase.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-black text-[#7c3aed] font-sans">৳{(purchase.totalCents / 100).toFixed(0)}</Text>
                    <Badge variant={purchase.paymentStatus === 'PAID' ? 'success' : purchase.paymentStatus === 'PARTIAL' ? 'warning' : 'destructive'} label={purchase.paymentStatus} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View className="flex-row items-center justify-between border-t border-slate-100 pt-4">
            <Text className="text-[10px] font-bold text-slate-500 font-sans">
              {isBn ? `মোট ক্রয় অর্ডার: ${purchases.length} • দেখানো: ${purchases.length}` : `Total PO: ${purchases.length} • Showing: ${purchases.length}`}
            </Text>
            <View className="flex-row">
              <TouchableOpacity className="flex-row items-center border border-slate-200 rounded-lg px-2 py-1 mr-2 bg-white">
                <ChevronLeft color="#cbd5e1" size={14} />
                <Text className="text-[10px] font-bold text-slate-400 font-sans ml-1">{isBn ? 'পূর্ববর্তী' : 'Prev'}</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row items-center border border-slate-200 rounded-lg px-2 py-1 bg-white">
                <Text className="text-[10px] font-bold text-slate-400 font-sans mr-1">{isBn ? 'পরবর্তী' : 'Next'}</Text>
                <ChevronRight color="#cbd5e1" size={14} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Details Card (Empty State) */}
        <View className="bg-white rounded-2xl shadow-sm border border-slate-100 items-center justify-center py-16">
          <View className="bg-slate-100 p-4 rounded-full mb-4">
            <Truck color="#94a3b8" size={24} />
          </View>
          <Text className="text-sm font-black text-slate-700 font-sans mb-1">
            {isBn ? 'ক্রয় অর্ডার বিস্তারিত' : 'Purchase Order Details'}
          </Text>
          <Text className="text-[10px] font-bold text-slate-400 font-sans">
            {isBn ? 'বাম পাশের তালিকা থেকে একটি ক্রয় অর্ডার নির্বাচন করুন।' : 'Select a purchase order from the list.'}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
