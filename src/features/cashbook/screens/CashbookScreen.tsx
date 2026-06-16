import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Modal, Alert, TouchableOpacity } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { cashbookApi, CashbookEntryInput, CashbookEntry } from '@/lib/api/modules/cashbook.api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/utils/translation';

export function CashbookScreen() {
  const db = SQLite.useSQLiteContext();
  const [balance, setBalance] = useState<number>(0);
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  
  // Form values
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  // Load balances and entries from local SQLite cashbook tables
  const loadData = useCallback(async () => {
    try {
      // 1. Calculate balance
      const balanceRow = await db.getFirstAsync<{ currentBalance: number | null }>(
        `SELECT (
          (SELECT COALESCE(SUM(amountCents), 0) FROM cashbook_entries WHERE type = 'IN') - 
          (SELECT COALESCE(SUM(amountCents), 0) FROM cashbook_entries WHERE type = 'OUT')
         ) as currentBalance`
      );
      setBalance(balanceRow?.currentBalance ?? 0);

      // 2. Fetch history
      const rows = await db.getAllAsync<CashbookEntry>(
        'SELECT id, type, amountCents, description, source, reference, isSynced, createdAt FROM cashbook_entries ORDER BY createdAt DESC'
      );
      setEntries(rows);
    } catch (err) {
      console.error('[Cashbook] SQLite read error:', err);
    }
  }, [db]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCashIn = async () => {
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('ত্রুটি / Error', 'সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }
    if (!description.trim()) {
      Alert.alert('ত্রুটি / Error', 'বিবরণ লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const payload: CashbookEntryInput = {
        id: Math.random().toString(),
        amountCents: Math.round(amountVal * 100),
        description,
        reference: reference || undefined,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const result = await cashbookApi.recordCashIn(db, payload, true);
      
      setLoading(false);
      setShowInModal(false);
      setAmount('');
      setDescription('');
      setReference('');
      void loadData();

      Alert.alert(
        result.offline ? 'অফলাইন সেভ / Saved Offline' : 'সফল হয়েছে / Success',
        result.offline ? 'জমা অফলাইনে সেভ করা হয়েছে এবং সিঙ্ক হবে।' : 'জমা সার্ভারে রেকর্ড করা হয়েছে।'
      );
    } catch (err) {
      setLoading(false);
      Alert.alert('ত্রুটি / Error', 'ক্যাশ-ইন রেকর্ড করা সম্ভব হয়নি।');
    }
  };

  const handleCashOut = async () => {
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('ত্রুটি / Error', 'সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }
    if (!description.trim()) {
      Alert.alert('ত্রুটি / Error', 'বিবরণ লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const payload: CashbookEntryInput = {
        id: Math.random().toString(),
        amountCents: Math.round(amountVal * 100),
        description,
        reference: reference || undefined,
        source: 'MANUAL',
        createdAt: Date.now(),
      };

      const result = await cashbookApi.recordCashOut(db, payload, true);

      setLoading(false);
      setShowOutModal(false);
      setAmount('');
      setDescription('');
      setReference('');
      void loadData();

      Alert.alert(
        result.offline ? 'অফলাইন সেভ / Saved Offline' : 'সফল হয়েছে / Success',
        result.offline ? 'খরচ অফলাইনে সেভ করা হয়েছে এবং সিঙ্ক হবে।' : 'খরচ সার্ভারে রেকর্ড করা হয়েছে।'
      );
    } catch (err) {
      setLoading(false);
      Alert.alert('ত্রুটি / Error', 'ক্যাশ-আউট রেকর্ড করা সম্ভব হয়নি।');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      
      {/* 1. Cash Balance Overview Header */}
      <View className="bg-slate-800 p-6 rounded-b-3xl border-b border-slate-700/40 items-center justify-center">
        <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">
          বর্তমান ক্যাশ ব্যালেন্স (Cash-in-Hand)
        </Text>
        <Text className="text-3xl font-black text-white font-sans mt-2">
          ৳{(balance / 100).toFixed(2)}
        </Text>
      </View>

      {/* 2. Operations Quick Triggers */}
      <View className="flex-row justify-between px-6 py-4">
        <TouchableOpacity
          onPress={() => setShowInModal(true)}
          activeOpacity={0.8}
          className="bg-emerald-500 rounded-xl px-6 py-3 items-center justify-center flex-1 mr-2"
        >
          <Text className="text-white text-xs font-extrabold font-sans">নগদ জমা (+ Cash In)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowOutModal(true)}
          activeOpacity={0.8}
          className="bg-rose-500 rounded-xl px-6 py-3 items-center justify-center flex-1 ml-2"
        >
          <Text className="text-white text-xs font-extrabold font-sans">নগদ খরচ (- Cash Out)</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Transaction History Register */}
      <Text className="text-xs font-black text-slate-800 px-6 uppercase tracking-wider mb-2 font-sans">
        লেনদেন রেজিস্টার / History
      </Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        {entries.length === 0 ? (
          <Text className="text-center text-xs text-slate-400 mt-8 font-sans">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</Text>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} style={{ marginBottom: 10 }} className="flex-row items-center justify-between border-slate-200/50">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center space-x-2 mb-1">
                  <Badge
                    label={entry.type === 'IN' ? 'জমা / In' : 'খরচ / Out'}
                    variant={entry.type === 'IN' ? 'success' : 'destructive'}
                  />
                  <Text className="text-[9px] text-slate-400 font-mono font-bold bg-slate-100 px-1 rounded ml-2">
                    {entry.source}
                  </Text>
                </View>
                <Text className="text-xs font-extrabold text-slate-700 font-sans">{entry.description}</Text>
                <Text className="text-[9px] text-slate-400 font-medium font-sans mt-0.5">
                  {new Date(entry.createdAt).toLocaleDateString('bn-BD')}
                </Text>
              </View>

              <View className="items-end">
                <Text className={`text-sm font-black font-sans ${entry.type === 'IN' ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {entry.type === 'IN' ? '+' : '-'} ৳{(entry.amountCents / 100).toFixed(2)}
                </Text>
                <Badge
                  label={entry.isSynced ? 'synced' : 'pending'}
                  variant={entry.isSynced ? 'primary' : 'neutral'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* Cash In Modal */}
      {/* ======================================================== */}
      <Modal visible={showInModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <View className="bg-white rounded-t-3xl p-6 border-t border-slate-100 space-y-4">
            <Text className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 font-sans">
              ক্যাশ-ইন জমা এন্ট্রি
            </Text>
            
            <Input label="জমার পরিমাণ (৳)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <Input label="বিবরণ" placeholder="যেমন: ক্যাশ জোগান" value={description} onChangeText={setDescription} />
            <Input label="রেফারেন্স নম্বর (ঐচ্ছিক)" placeholder="ভাউচার নম্বর" value={reference} onChangeText={setReference} />

            <View className="flex-row justify-between pt-2">
              <TouchableOpacity onPress={() => setShowInModal(false)} className="px-5 py-3 rounded-xl bg-slate-100 active:bg-slate-200">
                <Text className="text-slate-600 text-xs font-bold font-sans">বাতিল / Close</Text>
              </TouchableOpacity>
              <View className="flex-1 ml-4">
                <Button label={t('submit')} onPress={handleCashIn} loading={loading} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* Cash Out Modal */}
      {/* ======================================================== */}
      <Modal visible={showOutModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <View className="bg-white rounded-t-3xl p-6 border-t border-slate-100 space-y-4">
            <Text className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 font-sans">
              ক্যাশ-আউট খরচ এন্ট্রি
            </Text>

            <Input label="খরচের পরিমাণ (৳)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
            <Input label="বিবরণ" placeholder="যেমন: মেহমান আপ্যায়ন" value={description} onChangeText={setDescription} />
            <Input label="রেফারেন্স নম্বর (ঐচ্ছিক)" placeholder="ভাউচার নম্বর" value={reference} onChangeText={setReference} />

            <View className="flex-row justify-between pt-2">
              <TouchableOpacity onPress={() => setShowOutModal(false)} className="px-5 py-3 rounded-xl bg-slate-100 active:bg-slate-200">
                <Text className="text-slate-600 text-xs font-bold font-sans">বাতিল / Close</Text>
              </TouchableOpacity>
              <View className="flex-1 ml-4">
                <Button label={t('submit')} onPress={handleCashOut} loading={loading} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
export default CashbookScreen;
