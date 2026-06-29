import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi, Bell, User, DollarSign, Wallet, Smartphone, HelpCircle, Search, Plus } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMfsAccounts, listMfsTransactions, createMfsTransaction, MfsProvider, MfsTransactionType } from '@/lib/api/modules/mfs.api';
import { useNetworkStore } from '@/lib/network/network.store';

export function MobileServicesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  
  const [activeTab, setActiveTab] = useState<'summary' | 'mfs' | 'flexiload'>('summary');

  // MFS Transaction Form State
  const [mfsProvider, setMfsProvider] = useState<MfsProvider>('BKASH');
  const [txType, setTxType] = useState<MfsTransactionType>('CASH_IN');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [txid, setTxid] = useState('');
  
  // Queries
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['mfsAccounts'],
    queryFn: listMfsAccounts,
    enabled: isOnline,
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['mfsTransactions'],
    queryFn: () => listMfsTransactions({ limit: 10 }),
    enabled: isOnline,
  });

  // Mutation
  const addTransactionMutation = useMutation({
    mutationFn: (data: any) => createMfsTransaction(data),
    onSuccess: () => {
      Alert.alert('Success', 'Transaction recorded successfully');
      setCustomerPhone('');
      setAmount('');
      setTxid('');
      queryClient.invalidateQueries({ queryKey: ['mfsTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['mfsAccounts'] });
    },
    onError: () => Alert.alert('Error', 'Failed to record transaction')
  });

  const handleAddTransaction = () => {
    if (!customerPhone || !amount) {
      Alert.alert('Error', 'Phone and Amount are required');
      return;
    }
    const account = accounts?.find(a => a.provider === mfsProvider);
    if (!account) {
      Alert.alert('Error', 'No account found for this provider');
      return;
    }
    
    addTransactionMutation.mutate({
      mfsAccountId: account.id,
      type: txType,
      customerPhone,
      amountCents: Math.round(parseFloat(amount) * 100),
      txid: txid || undefined,
    });
  };

  const getBalance = (provider: MfsProvider) => {
    const acc = accounts?.find(a => a.provider === provider);
    if (!acc) return '৳0';
    return `৳${(acc.balanceCents / 100).toLocaleString()}`;
  };

  const FloatCard = ({ title, sub, amountText, color }: { title: string, sub: string, amountText: string, color: string }) => (
    <View className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm w-[48%]">
      <Text className={`text-xs font-black font-sans mb-1`} style={{ color }}>{title}</Text>
      <Text className="text-xl font-black text-slate-800 font-sans mb-1">{amountText}</Text>
      <Text className="text-[9px] text-slate-400 font-bold font-sans">{sub}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f1f5f9' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Segmented Controls */}
        <View className="bg-white border border-slate-200 rounded-xl flex-row p-1 mb-6 shadow-sm">
          <TouchableOpacity 
            onPress={() => setActiveTab('summary')}
            className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeTab === 'summary' ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-bold font-sans text-center ${activeTab === 'summary' ? 'text-white' : 'text-slate-800'}`}>সারসংক্ষেপ{'\n'}(Summary)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('mfs')}
            className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeTab === 'mfs' ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-bold font-sans text-center ${activeTab === 'mfs' ? 'text-white' : 'text-slate-800'}`}>মোবাইল ব্যাংকিং{'\n'}(MFS)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('flexiload')}
            className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeTab === 'flexiload' ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-bold font-sans text-center ${activeTab === 'flexiload' ? 'text-white' : 'text-slate-800'}`}>ফ্লেক্সিলোড{'\n'}(Flexiload)</Text>
          </TouchableOpacity>
        </View>

        {(loadingAccounts || loadingTransactions) && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        )}

        {!loadingAccounts && !loadingTransactions && activeTab === 'summary' && (
          <View>
            <View className="flex-row flex-wrap justify-between mb-2">
              <FloatCard title="বিকাশ এজেন্ট ব্যালেন্স" sub="bKash Float Wallet" amountText={getBalance('BKASH')} color="#e11471" />
              <FloatCard title="নগদ এজেন্ট ব্যালেন্স" sub="Nagad Float Wallet" amountText={getBalance('NAGAD')} color="#ec1c24" />
              <FloatCard title="রকেট এজেন্ট ব্যালেন্স" sub="Rocket Float Wallet" amountText={getBalance('ROCKET')} color="#8b3098" />
              <FloatCard title="উপায় এজেন্ট ব্যালেন্স" sub="Upay Float Wallet" amountText={getBalance('UPAY')} color="#f58220" />
            </View>

            <View className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-500 font-sans mb-1">সর্বমোট কমিশন আয়</Text>
                <Text className="text-3xl font-black text-slate-800 font-sans mb-1">
                  ৳{((transactions?.data?.reduce((acc, curr) => acc + (curr.commissionCents || 0), 0) || 0) / 100).toLocaleString()}
                </Text>
                <View className="bg-emerald-50 rounded px-2 py-1 self-start">
                  <Text className="text-[9px] font-bold text-emerald-600 font-sans">Net Service Commission Profit</Text>
                </View>
              </View>
              <View className="w-12 h-12 bg-emerald-50 rounded-xl items-center justify-center border border-emerald-100">
                <DollarSign size={24} color="#10b981" />
              </View>
            </View>

            <View className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-500 font-sans mb-1">মোট এমএফএস লেনদেন</Text>
                <Text className="text-3xl font-black text-slate-800 font-sans mb-1">{transactions?.meta?.total || 0} টি</Text>
                <Text className="text-[10px] font-bold text-slate-800 font-sans">Cash In / Cash Out Bookings</Text>
              </View>
              <View className="w-12 h-12 bg-indigo-50 rounded-xl items-center justify-center border border-indigo-100">
                <Wallet size={24} color="#6366f1" />
              </View>
            </View>

            <TouchableOpacity className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex-row items-center">
              <HelpCircle size={20} color="#64748b" className="mr-3" />
              <View>
                <Text className="text-sm font-black text-slate-800 font-sans">ইউএসএসডি কোড রেফারেন্স গাইড</Text>
                <Text className="text-sm font-black text-slate-800 font-sans">(USSD Codes Reference)</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {!loadingAccounts && activeTab === 'mfs' && (
          <View>
            {/* Ledger List */}
            <View className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
              <Text className="text-base font-black text-slate-800 font-sans mb-1">এমএফএস ক্যাশ বুক (MFS Cash Book)</Text>
              <Text className="text-xs text-slate-500 font-sans mb-4 border-b border-slate-100 pb-3">Chronological Ledger logs of Agent Actions</Text>
              
              <View className="flex-row flex-wrap mb-4">
                {['সব (All)', 'bkash', 'nagad', 'rocket', 'upay'].map((f) => (
                  <View key={f} className={`border border-slate-200 rounded-full px-3 py-1.5 mr-2 mb-2 ${f === 'সব (All)' ? 'bg-[#7c3aed] border-[#7c3aed]' : 'bg-white'}`}>
                    <Text className={`text-[11px] font-bold font-sans ${f === 'সব (All)' ? 'text-white' : 'text-slate-600'}`}>{f}</Text>
                  </View>
                ))}
              </View>

              <View className="border border-slate-200 rounded-lg flex-row items-center px-3 py-2.5 mb-6">
                <Search size={16} color="#94a3b8" className="mr-2" />
                <TextInput placeholder="মোবাইল নম্বর বা ট্রানজেকশন আইডি দিয়ে খুঁজুন..." className="flex-1 font-sans text-sm text-slate-800" />
              </View>

              {transactions?.data?.length === 0 ? (
                <Text className="text-center text-slate-500 py-10 font-bold font-sans">কোনো মোবাইল ব্যাংকিং লেনদেন পাওয়া যায়নি।</Text>
              ) : (
                transactions?.data?.map((t) => (
                  <View key={t.id} className="border-b border-slate-100 py-3 flex-row justify-between items-center">
                    <View>
                      <Text className="font-bold text-slate-800 font-sans">{t.type} • {t.mfsAccount?.provider}</Text>
                      <Text className="text-xs text-slate-500 font-sans">{t.customerPhone}</Text>
                    </View>
                    <Text className="font-black text-slate-800 font-sans">৳{(t.amountCents / 100).toLocaleString()}</Text>
                  </View>
                ))
              )}
            </View>

            {/* New Transaction Form */}
            <View className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
              <View className="flex-row items-center border-b border-slate-100 pb-3 mb-4">
                <Plus size={18} color="#7c3aed" className="mr-2" />
                <View>
                  <Text className="text-base font-black text-slate-800 font-sans mb-1">নতুন এমএফএস লেনদেন রেকর্ড</Text>
                  <Text className="text-[11px] text-slate-500 font-sans">Record Cash Out, In, or Send Money</Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-slate-800 font-sans mb-2">মোবাইল ব্যাংকিং সেবা (MFS)</Text>
              <View className="flex-row flex-wrap mb-4">
                {(['BKASH', 'NAGAD', 'ROCKET', 'UPAY'] as MfsProvider[]).map((p) => (
                  <TouchableOpacity key={p} onPress={() => setMfsProvider(p)} className={`border rounded-lg px-4 py-2.5 mr-2 mb-2 ${mfsProvider === p ? 'border-[#e11471] bg-pink-50' : 'border-slate-200 bg-white'}`}>
                    <Text className={`text-xs font-black font-sans ${mfsProvider === p ? 'text-[#e11471]' : 'text-slate-600'}`}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-bold text-slate-800 font-sans mb-2">লেনদেনের ধরণ</Text>
              <View className="flex-row flex-wrap mb-4">
                <TouchableOpacity onPress={() => setTxType('CASH_IN')} className={`border rounded-lg px-4 py-2.5 mr-2 mb-2 ${txType === 'CASH_IN' ? 'border-[#7c3aed] bg-purple-50' : 'border-slate-200 bg-white'}`}>
                  <Text className={`text-xs font-bold font-sans ${txType === 'CASH_IN' ? 'text-[#7c3aed]' : 'text-slate-800'}`}>ক্যাশ ইন (In)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTxType('CASH_OUT')} className={`border rounded-lg px-4 py-2.5 mr-2 mb-2 ${txType === 'CASH_OUT' ? 'border-[#7c3aed] bg-purple-50' : 'border-slate-200 bg-white'}`}>
                  <Text className={`text-xs font-bold font-sans ${txType === 'CASH_OUT' ? 'text-[#7c3aed]' : 'text-slate-800'}`}>ক্যাশ আউট (Out)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTxType('SEND_MONEY')} className={`border rounded-lg px-4 py-2.5 mr-2 mb-2 ${txType === 'SEND_MONEY' ? 'border-[#7c3aed] bg-purple-50' : 'border-slate-200 bg-white'}`}>
                  <Text className={`text-xs font-bold font-sans ${txType === 'SEND_MONEY' ? 'text-[#7c3aed]' : 'text-slate-800'}`}>সেন্ড মানি (Send)</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-xs font-bold text-slate-800 font-sans mb-2">গ্রাহক মোবাইল নম্বর *</Text>
              <TextInput 
                className="border border-slate-200 rounded-lg h-12 px-3 mb-4 font-sans text-slate-800" 
                placeholder="যেমন: 017XXXXXXXX"
                keyboardType="phone-pad"
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />

              <View className="flex-row mb-6">
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-bold text-slate-800 font-sans mb-2">পরিমাণ (৳) *</Text>
                  <TextInput 
                    className="border border-slate-200 rounded-lg h-12 px-3 font-sans text-slate-800" 
                    placeholder="0"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-xs font-bold text-slate-800 font-sans mb-2">লেনদেন আইডি / TrxID (ঐচ্ছিক)</Text>
                  <TextInput 
                    className="border border-slate-200 rounded-lg h-12 px-3 font-sans text-slate-800" 
                    placeholder="TrxID..."
                    value={txid}
                    onChangeText={setTxid}
                  />
                </View>
              </View>

              <TouchableOpacity 
                className={`py-3.5 rounded-lg items-center ${addTransactionMutation.isPending ? 'bg-slate-400' : 'bg-[#7c3aed]'}`}
                onPress={handleAddTransaction}
                disabled={addTransactionMutation.isPending}
              >
                {addTransactionMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold font-sans text-sm">যোগ করুন</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
