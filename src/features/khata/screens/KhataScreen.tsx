import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, Alert, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { khataApi, CollectionInput } from '@/lib/api/modules/khata.api';
import { pullCustomers } from '@/features/sync/pull-sync';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Users, Truck, Scale, Search, UserPlus, FolderOpen, ChevronLeft, ChevronRight, UserCircle2 } from 'lucide-react-native';
import { useLanguageStore, t } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { newId } from '@/lib/id';
import { Wifi, Bell, User } from 'lucide-react-native';

interface Customer {
  id: string;
  name: string;
  phone: string;
  dueCents: number;
  creditLimitCents: number;
  khataAccountId: string | null;
}

export function KhataScreen() {
  const insets = useSafeAreaInsets();
  const db = SQLite.useSQLiteContext();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  
  // Due collection form fields
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MFS' | 'BANK'>('CASH');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState<'summary' | 'customer' | 'supplier'>('summary');

  // Fetch customer ledgers from SQLite
  const loadCustomers = useCallback(async () => {
    try {
      let query = 'SELECT id, name, phone, dueCents, creditLimitCents, khataAccountId FROM customers';
      let params: any[] = [];

      if (search.trim()) {
        query += ' WHERE name LIKE ? OR phone LIKE ?';
        params = [`%${search}%`, `%${search}%`];
      }

      query += ' ORDER BY dueCents DESC, name ASC';
      const rows = await db.getAllAsync<Customer>(query, params);
      setCustomers(rows);
    } catch (err) {
      console.error('[Khata] SQLite fetch error:', err);
    }
  }, [db, search]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Pull latest customer dues from the server (server is authority for balances).
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        await pullCustomers(db);
        await loadCustomers();
      } else {
        Alert.alert(
          isBn ? 'অফলাইন' : 'Offline',
          isBn ? 'সর্বশেষ বাকি পেতে ইন্টারনেট প্রয়োজন।' : 'Internet is required to refresh dues.'
        );
      }
    } catch (err) {
      console.warn('[Khata] Refresh failed:', (err as Error)?.message);
    } finally {
      setRefreshing(false);
    }
  }, [db, isOnline, isBn, loadCustomers]);

  // Handle reminder notification dispatch via WhatsApp or SMS
  const sendDueReminder = async (customer: Customer) => {
    if (!customer.phone) {
      Alert.alert(
        isBn ? 'ত্রুটি' : 'Error',
        isBn ? 'গ্রাহকের ফোন নম্বর পাওয়া যায়নি।' : 'Customer phone number not available.'
      );
      return;
    }

    const dueAmount = (customer.dueCents / 100).toFixed(2);
    const reminderText = isBn
      ? `প্রিয় ${customer.name}, BizOS থেকে স্মরণ করিয়ে দেওয়া হচ্ছে যে আপনার বকেয়া ৳${dueAmount} পরিশোধের জন্য পেন্ডিং আছে। দয়া করে পরিশোধ করুন। ধন্যবাদ!`
      : `Dear ${customer.name}, this is a friendly reminder from BizOS. You have a pending due of ৳${dueAmount}. Please settle your payment at your earliest convenience. Thank you!`;

    const whatsappUrl = `whatsapp://send?phone=${customer.phone.replace(/[^0-9+]/g, '')}&text=${encodeURIComponent(reminderText)}`;
    const smsUrl = `sms:${customer.phone}?body=${encodeURIComponent(reminderText)}`;

    try {
      const canOpenWhatsapp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsapp) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to SMS if WhatsApp is not installed
        await Linking.openURL(smsUrl);
      }
    } catch (err) {
      // Direct SMS open try
      try {
        await Linking.openURL(smsUrl);
      } catch (smsErr) {
        Alert.alert(
          isBn ? 'শেয়ার ব্যর্থ হয়েছে' : 'Reminder Failed',
          isBn 
            ? 'বার্তা পাঠানো সম্ভব হয়নি। বার্তা কপি করে ম্যানুয়ালি পাঠান:\n\n' + reminderText
            : 'Unable to open messaging app. Copy reminder text manually:\n\n' + reminderText
        );
      }
    }
  };

  // Process collecting due amount payment
  const handleCollectDue = async () => {
    if (!selectedCustomer) return;

    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert(
        isBn ? 'ত্রুটি' : 'Error',
        isBn ? 'সঠিক টাকার পরিমাণ লিখুন।' : 'Please enter a valid amount.'
      );
      return;
    }

    const collectedCents = Math.round(amountVal * 100);
    if (collectedCents > selectedCustomer.dueCents) {
      Alert.alert(
        isBn ? 'সতর্কতা' : 'Warning',
        isBn 
          ? 'গ্রাহকের সর্বমোট বকেয়া চেয়ে বেশি টাকা আদায় করা হচ্ছে।' 
          : 'Collection amount is greater than the total due amount.'
      );
    }

    // Real backend khata account id is required to sync the collection to the
    // correct ledger. Demo/local-only customers without one can't be synced.
    if (!selectedCustomer.khataAccountId) {
      Alert.alert(
        isBn ? 'সিঙ্ক সম্ভব নয়' : 'Cannot Sync',
        isBn
          ? 'এই গ্রাহক এখনো সার্ভারের সাথে যুক্ত হয়নি। তালিকা রিফ্রেশ করে আবার চেষ্টা করুন।'
          : 'This customer is not linked to the server yet. Pull to refresh the list and try again.'
      );
      return;
    }

    setLoading(true);
    try {
      const payload: CollectionInput = {
        id: newId(),
        customerId: selectedCustomer.id,
        accountId: selectedCustomer.khataAccountId, // backend khata account id
        amountCents: collectedCents,
        paymentMethod,
        reference: reference || undefined,
        createdAt: Date.now(),
      };

      const result = await khataApi.recordCollection(db, payload, !isOnline);

      setLoading(false);
      setShowCollectModal(false);
      setAmount('');
      setReference('');
      setSelectedCustomer(null);
      void loadCustomers();

      Alert.alert(
        result.offline 
          ? (isBn ? 'অফলাইন সেভ' : 'Saved Offline') 
          : (isBn ? 'সফল হয়েছে' : 'Success'),
        result.offline 
          ? (isBn ? 'জমা অফলাইনে সেভ করা হয়েছে এবং সিঙ্ক হবে।' : 'Due collection saved offline and will sync.')
          : (isBn ? 'জমা রেকর্ড করা হয়েছে।' : 'Due collection recorded successfully.')
      );
    } catch (err) {
      setLoading(false);
      Alert.alert(
        isBn ? 'ত্রুটি' : 'Error',
        isBn ? 'বকেয়া জমা রেকর্ড করা সম্ভব হয়নি।' : 'Failed to record due collection.'
      );
    }
  };

  const totalOutstandingDueCents = customers.reduce((sum, c) => sum + c.dueCents, 0);

  const [filterTab, setFilterTab] = useState<'all' | 'due' | 'paid'>('all');

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
            <Wifi size={16} color={isOnline ? "#10b981" : "#94a3b8"} />
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 rounded-full border border-slate-200 items-center justify-center">
            <Bell size={16} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 rounded-full border border-slate-200 items-center justify-center bg-purple-50">
            <User size={16} color="#7c3aed" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}>
        
        <View className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
          <View className="flex-row items-center mb-1">
            <Users size={24} color="#7c3aed" className="mr-2" />
            <Text className="text-xl font-black text-slate-800 font-sans tracking-tight">গ্রাহক ও বাকির খাতা</Text>
          </View>
          <Text className="text-[11px] font-semibold text-slate-500 font-sans mb-4 ml-8">Customer List & Dues Directory</Text>

          <TouchableOpacity className="bg-[#7c3aed] rounded-lg py-3 px-4 flex-row items-center justify-center self-start mb-6">
            <UserPlus size={16} color="#ffffff" className="mr-2" />
            <Text className="text-white font-bold font-sans text-sm">নতুন গ্রাহক যোগ</Text>
          </TouchableOpacity>

          <View className="border-t border-slate-100 pt-5 mb-4">
            <View className="flex-row items-center border border-slate-200 rounded-lg px-3 h-12 mb-4">
              <Search size={18} color="#94a3b8" />
              <Input
                placeholder="নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
                value={search}
                onChangeText={setSearch}
                onClear={() => setSearch('')}
                className="flex-1 border-0 bg-transparent mb-0 px-2 font-sans"
              />
            </View>

            <View className="flex-row items-center border border-slate-200 rounded-lg p-0.5 self-start mb-6">
              <TouchableOpacity onPress={() => setFilterTab('all')} className={`px-4 py-2 rounded-md ${filterTab === 'all' ? 'bg-white shadow-sm' : ''}`}>
                <Text className={`text-xs font-bold font-sans ${filterTab === 'all' ? 'text-slate-800' : 'text-slate-500'}`}>সবাই</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterTab('due')} className={`px-4 py-2 rounded-md ${filterTab === 'due' ? 'bg-white shadow-sm' : ''}`}>
                <Text className={`text-xs font-bold font-sans ${filterTab === 'due' ? 'text-slate-800' : 'text-slate-500'}`}>বাকি আছে</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterTab('paid')} className={`px-4 py-2 rounded-md ${filterTab === 'paid' ? 'bg-white shadow-sm' : ''}`}>
                <Text className={`text-xs font-bold font-sans ${filterTab === 'paid' ? 'text-slate-800' : 'text-slate-500'}`}>পরিশোধিত</Text>
              </TouchableOpacity>
            </View>

            <View className="border border-dashed border-slate-200 rounded-xl py-12 items-center justify-center bg-slate-50 mb-6">
              <FolderOpen size={40} color="#cbd5e1" className="mb-3" />
              <Text className="text-slate-500 font-bold font-sans text-sm">কোনো গ্রাহকের হিসাব খুঁজে পাওয়া যায়নি।</Text>
            </View>

            <View className="flex-row items-center justify-between border-t border-slate-100 pt-4">
              <Text className="text-xs text-slate-500 font-sans font-semibold">মোট গ্রাহক: ০ • দেখানো: ০</Text>
              <View className="flex-row">
                <TouchableOpacity className="border border-slate-200 rounded-md px-3 py-1.5 flex-row items-center mr-2 opacity-50" disabled>
                  <ChevronLeft size={14} color="#94a3b8" />
                  <Text className="text-slate-400 font-bold font-sans text-[11px] ml-1">পূর্ববর্তী</Text>
                </TouchableOpacity>
                <TouchableOpacity className="border border-slate-200 rounded-md px-3 py-1.5 flex-row items-center opacity-50" disabled>
                  <Text className="text-slate-400 font-bold font-sans text-[11px] mr-1">পরবর্তী</Text>
                  <ChevronRight size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm items-center justify-center py-16">
          <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4">
            <UserCircle2 size={32} color="#94a3b8" />
          </View>
          <Text className="text-lg font-black text-slate-800 font-sans mb-2">গ্রাহক হিসাব নির্বাচন করুন</Text>
          <Text className="text-slate-500 text-center font-sans text-xs leading-relaxed px-4">
            বাম পাশের তালিকা থেকে যেকোনো কাস্টমারের{'\n'}নামের পাশে চাপ দিলে তাদের লেনদেন ইতিহাস{'\n'}ও বকেয়া এন্ট্রি করা যাবে।
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
export default KhataScreen;
