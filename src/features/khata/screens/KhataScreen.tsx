import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, Alert, TouchableOpacity, Linking, RefreshControl } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { khataApi, CollectionInput } from '@/lib/api/modules/khata.api';
import { pullCustomers } from '@/features/sync/pull-sync';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLanguageStore, t } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';

interface Customer {
  id: string;
  name: string;
  phone: string;
  dueCents: number;
  creditLimitCents: number;
  khataAccountId: string | null;
}

export function KhataScreen() {
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
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      
      {/* 1. Header Overview Summary Card */}
      <View className="bg-slate-800 p-6 rounded-b-3xl border-b border-slate-700/40 items-center justify-center">
        <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">
          {isBn ? 'সর্বমোট পাওনা (Total Dues Outstanding)' : 'Total Outstanding Receivables'}
        </Text>
        <Text className="text-3xl font-black text-amber-500 font-sans mt-2">
          ৳{(totalOutstandingDueCents / 100).toFixed(2)}
        </Text>
      </View>

      {/* 2. Search Input */}
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
        <Input
          placeholder={isBn ? "গ্রাহকের নাম বা মোবাইল নম্বর খুঁজুন..." : "Search customer name or phone..."}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {/* 3. Customer Debtors List */}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {customers.length === 0 ? (
          <Text className="text-center text-xs text-slate-450 mt-8 font-sans">
            {isBn ? 'কোনো বাকি কাস্টমার রেকর্ড পাওয়া যায়নি' : 'No due records found'}
          </Text>
        ) : (
          customers.map((customer) => (
            <Card key={customer.id} style={{ marginBottom: 12 }} className="border-slate-200/50">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-black text-slate-800 font-sans">{customer.name}</Text>
                  {customer.phone && (
                    <Text className="text-xs text-slate-450 font-semibold font-mono mt-0.5">{customer.phone}</Text>
                  )}
                  {customer.creditLimitCents > 0 && (
                    <Text className="text-[9px] text-slate-400 font-semibold font-sans mt-1">
                      {isBn ? 'সীমা: ' : 'Limit: '} ৳{(customer.creditLimitCents / 100).toFixed(0)}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-sm font-black text-amber-700 font-sans">
                    ৳{(customer.dueCents / 100).toFixed(2)}
                  </Text>
                  <Badge
                    label={customer.dueCents > customer.creditLimitCents && customer.creditLimitCents > 0 ? (isBn ? 'সীমা অতিক্রম' : 'Over Limit') : (isBn ? 'বাকি' : 'Due')}
                    variant={customer.dueCents > customer.creditLimitCents && customer.creditLimitCents > 0 ? 'destructive' : 'warning'}
                  />
                </View>
              </View>

              {/* Action Operations Panel */}
              <View className="flex-row mt-2 border-t border-slate-100 pt-2 space-x-2 justify-end">
                <TouchableOpacity
                  onPress={() => void sendDueReminder(customer)}
                  activeOpacity={0.8}
                  className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 flex-row items-center justify-center mr-2"
                >
                  <Text className="text-emerald-700 text-xs font-black font-sans">
                    💬 {isBn ? 'রিমাইন্ডার' : 'Reminder'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedCustomer(customer);
                    setShowCollectModal(true);
                  }}
                  activeOpacity={0.8}
                  className="bg-primary rounded-lg px-4 py-2 flex-row items-center justify-center"
                >
                  <Text className="text-white text-xs font-black font-sans">
                    ৳ {isBn ? 'বাকি আদায়' : 'Collect'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* Due Collection Modal */}
      {/* ======================================================== */}
      <Modal visible={showCollectModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <View className="bg-white rounded-t-3xl p-6 border-t border-slate-100 space-y-4">
            <Text className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 font-sans">
              {isBn 
                ? `বাকি সংগ্রহ - ${selectedCustomer?.name || ''}`
                : `Collect Due - ${selectedCustomer?.name || ''}`}
            </Text>

            <Input 
              label={isBn ? 'আদায়ের পরিমাণ (৳)' : 'Collected Amount (৳)'} 
              keyboardType="numeric" 
              value={amount} 
              onChangeText={setAmount} 
            />

            {/* Payment Method Picker */}
            <View>
              <Text className="text-xs font-bold text-slate-500 font-sans mb-2">
                {isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              </Text>
              <View className="flex-row space-x-2">
                {(['CASH', 'MFS', 'BANK'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    activeOpacity={0.8}
                    className={`flex-1 items-center justify-center py-2.5 rounded-xl border ${
                      paymentMethod === method 
                        ? 'bg-primary-50 border-primary' 
                        : 'bg-white border-slate-200'
                    } mr-2`}
                  >
                    <Text className={`text-xs font-extrabold font-sans ${
                      paymentMethod === method ? 'text-primary' : 'text-slate-500'
                    }`}>
                      {method === 'CASH' ? (isBn ? 'নগদ' : 'Cash') : method === 'MFS' ? (isBn ? 'মোবাইল' : 'MFS') : (isBn ? 'ব্যাংক' : 'Bank')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Input 
              label={isBn ? 'রেফারেন্স / ভাউচার নম্বর (ঐচ্ছিক)' : 'Reference / Voucher No. (Optional)'} 
              placeholder={isBn ? 'যেমন: বিকাশ ট্রানজেকশন আইডি' : 'e.g. Transaction ID'} 
              value={reference} 
              onChangeText={setReference} 
            />

            <View className="flex-row justify-between pt-2">
              <TouchableOpacity 
                onPress={() => {
                  setShowCollectModal(false);
                  setSelectedCustomer(null);
                  setAmount('');
                  setReference('');
                }} 
                className="px-5 py-3 rounded-xl bg-slate-100 active:bg-slate-200"
              >
                <Text className="text-slate-600 text-xs font-bold font-sans">
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <View className="flex-1 ml-4">
                <Button 
                  label={isBn ? 'দাখিল করুন' : 'Submit'} 
                  onPress={handleCollectDue} 
                  loading={loading} 
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
export default KhataScreen;
