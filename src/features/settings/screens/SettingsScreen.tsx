import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi, Bell, User, Store, Users, FileText, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useAuthStore } from '@/store/auth.store';
import { logoutAndRevoke } from '@/features/auth/logout';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from '@/features/sync/sync.store';
import { syncAll } from '@/features/sync/sync-engine';
import { biometrics } from '@/lib/auth/biometrics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShop, updateShop, updateShopSettings, Shop } from '@/lib/api/modules/shop.api';

const APP_VERSION = '1.0.0';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const db = SQLite.useSQLiteContext();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const user = useAuthStore((s) => s.user);
  const shopId = user?.shopId || user?.id || '';
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { isSyncing } = useSyncStore();
  const queryClient = useQueryClient();

  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(biometrics.isEnabledInSettings());
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'memo' | 'subscription'>('profile');

  // Form States
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', street: '', city: '' });
  const [memoForm, setMemoForm] = useState({ receiptHeader: '', receiptFooter: '', taxId: '', thankYouMessage: '' });
  const [teamForm, setTeamForm] = useState({ name: '', email: '', phone: '', role: 'মালিক' });

  // Fetch Shop Data
  const { data: shopData, isLoading: isShopLoading } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: () => getShop(shopId),
    enabled: !!shopId && isOnline,
  });

  useEffect(() => {
    if (shopData) {
      setProfileForm({
        name: shopData.name || '',
        phone: shopData.phone || '',
        email: shopData.email || '',
        street: shopData.address?.street || '',
        city: shopData.address?.city || ''
      });
      setMemoForm({
        receiptHeader: shopData.settings?.receiptHeader || '',
        receiptFooter: shopData.settings?.receiptFooter || '',
        taxId: shopData.settings?.taxId || '',
        thankYouMessage: (shopData.settings as any)?.thankYouMessage || ''
      });
    }
  }, [shopData]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => updateShop(shopId, data),
    onSuccess: () => {
      Alert.alert(isBn ? 'সফল' : 'Success', isBn ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile updated');
      queryClient.invalidateQueries({ queryKey: ['shop', shopId] });
    },
    onError: () => Alert.alert('Error', 'Failed to update profile')
  });

  const updateMemoMutation = useMutation({
    mutationFn: (data: any) => updateShopSettings(shopId, data),
    onSuccess: () => {
      Alert.alert(isBn ? 'সফল' : 'Success', isBn ? 'ক্যাশ মেমো সেটিংস আপডেট হয়েছে' : 'Memo settings updated');
      queryClient.invalidateQueries({ queryKey: ['shop', shopId] });
    },
    onError: () => Alert.alert('Error', 'Failed to update memo settings')
  });

  useEffect(() => {
    void biometrics.isSupported().then(setBioSupported);
  }, []);

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      const ok = await biometrics.authenticate(isBn ? 'বায়োমেট্রিক যাচাই করুন' : 'Verify to enable biometric unlock');
      if (!ok) return;
    }
    biometrics.setEnabledInSettings(next);
    setBioEnabled(next);
  };

  const handleSyncNow = () => {
    if (!isOnline) {
      Alert.alert(isBn ? 'অফলাইন' : 'Offline', isBn ? 'সিঙ্ক করতে ইন্টারনেট সংযোগ প্রয়োজন।' : 'An internet connection is required to sync.');
      return;
    }
    void syncAll(db);
  };

  const handleLogout = () => {
    Alert.alert(isBn ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout', isBn ? 'আপনি কি লগআউট করতে চান?' : 'Are you sure you want to log out?', [
      { text: isBn ? 'বাতিল' : 'Cancel', style: 'cancel' },
      { text: isBn ? 'লগআউট' : 'Log Out', style: 'destructive', onPress: () => void logoutAndRevoke() },
    ]);
  };

  const tabs = [
    { id: 'profile', label: 'প্রোফাইল সেটিংস', icon: Store },
    { id: 'team', label: 'টিম ও অ্যাক্সেস', icon: Users },
    { id: 'memo', label: 'ক্যাশ মেমো সেটিংস', icon: FileText },
    { id: 'subscription', label: 'সাবস্ক্রিপশন ও বিলিং', icon: CheckCircle2 },
  ] as const;

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

      <ScrollView className="flex-1 px-4 pt-5 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-black text-slate-800 font-sans mb-1">সেটিংস ও প্রোফাইল</Text>
        <Text className="text-xs text-slate-500 font-sans mb-5 leading-relaxed pr-8">
          দোকান প্রোফাইল, ক্যাশ মেমো বিলিং টেমপ্লেট এবং টিম মেম্বারদের রোল অ্যাক্সেস সেটিংস পরিচালনা করুন
        </Text>

        {/* Tabs */}
        <View className="bg-white rounded-xl border border-slate-200 p-1.5 flex-row flex-wrap mb-6 shadow-sm">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[20%] py-3 px-1 rounded-lg items-center justify-center ${isActive ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
              >
                <Icon size={14} color={isActive ? '#ffffff' : '#64748b'} className="mb-1.5" />
                <Text className={`text-[10px] text-center font-bold font-sans ${isActive ? 'text-white' : 'text-slate-700'}`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isShopLoading && (
          <View className="py-10 items-center">
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        )}

        {!isShopLoading && activeTab === 'profile' && (
          <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <Text className="text-base font-black text-slate-800 font-sans mb-5 pb-3 border-b border-slate-100">দোকান বিবরণ ও প্রোফাইল</Text>
            
            <View className="flex-row mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">দোকানের নাম *</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-12 px-3 font-bold text-slate-800 font-sans" 
                  value={profileForm.name} 
                  onChangeText={(t) => setProfileForm({...profileForm, name: t})} 
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">ফোন নম্বর</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-12 px-3 font-bold text-slate-800 font-sans" 
                  value={profileForm.phone} 
                  onChangeText={(t) => setProfileForm({...profileForm, phone: t})}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-500 font-sans mb-2">ইমেইল এড্রেস</Text>
              <TextInput 
                className="border border-slate-200 rounded-lg h-12 px-3 font-bold text-slate-800 font-sans" 
                value={profileForm.email} 
                onChangeText={(t) => setProfileForm({...profileForm, email: t})}
              />
            </View>

            <View className="flex-row mb-6">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">রাস্তা / এলাকা</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" 
                  value={profileForm.street}
                  placeholder="-" 
                  onChangeText={(t) => setProfileForm({...profileForm, street: t})}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">শহর / থানা</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" 
                  value={profileForm.city}
                  placeholder="-" 
                  onChangeText={(t) => setProfileForm({...profileForm, city: t})}
                />
              </View>
            </View>

            <TouchableOpacity 
              className={`py-3.5 px-6 rounded-lg self-start ${updateProfileMutation.isPending ? 'bg-slate-400' : 'bg-[#7c3aed]'}`}
              onPress={() => updateProfileMutation.mutate({
                name: profileForm.name,
                phone: profileForm.phone,
                email: profileForm.email,
                address: { ...shopData?.address, street: profileForm.street, city: profileForm.city }
              })}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold font-sans text-sm">সেভ করুন</Text>}
            </TouchableOpacity>
          </View>
        )}

        {!isShopLoading && activeTab === 'memo' && (
          <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <Text className="text-base font-black text-slate-800 font-sans mb-5 pb-3 border-b border-slate-100">ক্যাশ মেমো সেটিংস (Receipt Customization)</Text>
            
            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-500 font-sans mb-2">মেমো হেডার (RECEIPT HEADER)</Text>
              <TextInput 
                className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" 
                value={memoForm.receiptHeader}
                placeholder="যেমন: বিক্রয় মেমো" 
                onChangeText={(t) => setMemoForm({...memoForm, receiptHeader: t})}
              />
            </View>

            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-500 font-sans mb-2">মেমো ফুটার (RECEIPT FOOTER)</Text>
              <TextInput 
                className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" 
                value={memoForm.receiptFooter}
                placeholder="যেমন: ধন্যবাদ আবার আসবেন" 
                onChangeText={(t) => setMemoForm({...memoForm, receiptFooter: t})}
              />
            </View>

            <View className="flex-row mb-6">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">ট্যাক্স / মূসক আইডি (BIN/TAX ID)</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-24 px-3 py-3 text-slate-800 font-sans" 
                  value={memoForm.taxId}
                  multiline
                  textAlignVertical="top"
                  onChangeText={(t) => setMemoForm({...memoForm, taxId: t})}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">ধন্যবাদ বার্তা (THANK YOU MESSAGE)</Text>
                <TextInput 
                  className="border border-slate-200 rounded-lg h-24 px-3 py-3 text-slate-800 font-sans" 
                  value={memoForm.thankYouMessage}
                  multiline
                  textAlignVertical="top"
                  onChangeText={(t) => setMemoForm({...memoForm, thankYouMessage: t})}
                />
              </View>
            </View>

            <TouchableOpacity 
              className={`py-3.5 px-6 rounded-lg self-start ${updateMemoMutation.isPending ? 'bg-slate-400' : 'bg-[#7c3aed]'}`}
              onPress={() => updateMemoMutation.mutate({ settings: { ...shopData?.settings, receiptHeader: memoForm.receiptHeader, receiptFooter: memoForm.receiptFooter, taxId: memoForm.taxId, thankYouMessage: memoForm.thankYouMessage } })}
              disabled={updateMemoMutation.isPending}
            >
              {updateMemoMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold font-sans text-sm">আপডেট করুন</Text>}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'team' && (
          <View>
            <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
              <Text className="text-base font-black text-slate-800 font-sans mb-5 pb-3 border-b border-slate-100">টিম মেম্বার তালিকা</Text>
              
              <View className="border border-slate-200 rounded-lg p-4 flex-row items-center justify-between">
                <View>
                  <Text className="font-black text-slate-800 font-sans mb-1">John Doe</Text>
                  <Text className="text-xs text-slate-500 font-sans">admin@gmail.com • 01711000000</Text>
                </View>
                <View className="bg-indigo-50 border border-indigo-100 rounded px-2 py-1">
                  <Text className="text-[10px] font-black text-indigo-700 font-sans">মালিক</Text>
                </View>
              </View>
            </View>

            <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
              <View className="flex-row items-center mb-5 pb-3 border-b border-slate-100">
                <Text className="text-lg font-black text-[#7c3aed] mr-2">+</Text>
                <Text className="text-base font-black text-slate-800 font-sans">নতুন মেম্বার যুক্ত করুন</Text>
              </View>
              
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">মেম্বার নাম *</Text>
                <TextInput className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" value={teamForm.name} onChangeText={(t) => setTeamForm({...teamForm, name: t})} />
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">ইমেইল এড্রেস *</Text>
                <TextInput className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" value={teamForm.email} onChangeText={(t) => setTeamForm({...teamForm, email: t})} />
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">মোবাইল নম্বর (ঐচ্ছিক)</Text>
                <TextInput className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans" value={teamForm.phone} onChangeText={(t) => setTeamForm({...teamForm, phone: t})} />
              </View>

              <View className="mb-6">
                <Text className="text-xs font-bold text-slate-500 font-sans mb-2">মেম্বার রোল (ROLE) *</Text>
                <TextInput className="border border-slate-200 rounded-lg h-12 px-3 text-slate-800 font-sans bg-slate-50" value={teamForm.role} editable={false} />
              </View>

              <TouchableOpacity className="bg-[#7c3aed] py-3.5 rounded-lg items-center" onPress={() => Alert.alert('Success', 'Team member added! (Demo)')}>
                <Text className="text-white font-bold font-sans text-sm">যোগ করুন</Text>
              </TouchableOpacity>
            </View>

            {/* System Actions moved to bottom of Team tab as it was before */}
            <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
              <Text className="font-bold text-slate-700 mb-4 font-sans text-sm">সিস্টেম অ্যাকশন</Text>
              <TouchableOpacity onPress={handleLogout} className="bg-rose-50 border border-rose-100 p-3 rounded-lg items-center mb-2">
                <Text className="text-rose-600 font-bold font-sans">লগআউট (Log Out)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSyncNow} className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg items-center mb-2">
                <Text className="text-indigo-600 font-bold font-sans">{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'সিঙ্ক (Sync Now)'}</Text>
              </TouchableOpacity>
              <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <Text className="text-xs font-bold text-slate-700 font-sans">বায়োমেট্রিক লগইন</Text>
                <Switch
                  value={bioEnabled}
                  onValueChange={(v) => void toggleBiometric(v)}
                  disabled={!bioSupported}
                  trackColor={{ true: '#7c3aed', false: '#cbd5e1' }}
                />
              </View>
            </View>
          </View>
        )}

        {activeTab === 'subscription' && (
          <View>
            <View className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-base font-black text-slate-800 font-sans mb-0.5">বর্তমান সাবস্ক্রিপশন</Text>
                  <Text className="text-[11px] text-slate-500 font-sans">আপনার বর্তমান প্ল্যান এবং বিলিং স্ট্যাটাস</Text>
                </View>
                <View className="bg-indigo-50 border border-indigo-100 rounded-md px-3 py-1.5">
                  <Text className="text-[10px] font-black text-indigo-700 font-sans">{shopData?.plan || 'FREE PLAN'}</Text>
                </View>
              </View>

              <View className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex-row items-center">
                <AlertCircle size={20} color="#f59e0b" className="mr-3" />
                <View>
                  <Text className="text-sm font-bold text-slate-800 font-sans">আপনি বর্তমানে ফ্রি প্ল্যানে আছেন</Text>
                  <Text className="text-[10px] text-slate-500 font-sans mt-0.5">উন্নত ফিচার পেতে একটি প্রিমিয়াম প্ল্যান আপগ্রেড করুন।</Text>
                </View>
              </View>
            </View>

            <Text className="text-base font-black text-slate-800 font-sans mb-4">উপলব্ধ প্ল্যানসমূহ</Text>

            {/* Free Trial */}
            <View className="bg-white border border-indigo-100 rounded-xl p-5 mb-4 shadow-sm relative overflow-hidden">
              <View className="absolute top-0 left-0 w-1.5 h-full bg-[#7c3aed]" />
              <View className="flex-row items-center mb-3">
                <Store size={18} color="#7c3aed" className="mr-2" />
                <Text className="text-base font-black text-slate-800 font-sans">ফ্রি ট্রায়াল (Free Trial)</Text>
              </View>
              <View className="flex-row items-baseline mb-4">
                <Text className="text-3xl font-black text-slate-800 font-sans">৳০</Text>
                <Text className="text-xs text-slate-500 font-sans ml-1">/ মাস</Text>
              </View>
              
              <View className="space-y-2 mb-6">
                <View className="flex-row items-center mb-2">
                  <CheckCircle2 size={16} color="#10b981" className="mr-2" />
                  <Text className="text-sm text-slate-700 font-sans">পণ্য লিমিট: 50</Text>
                </View>
                <View className="flex-row items-center">
                  <CheckCircle2 size={16} color="#10b981" className="mr-2" />
                  <Text className="text-sm text-slate-700 font-sans">ট্রানজেকশন লিমিট: 100</Text>
                </View>
              </View>

              <TouchableOpacity className="bg-slate-100 py-3.5 rounded-lg items-center">
                <Text className="text-slate-500 font-bold font-sans text-sm">বর্তমান প্ল্যান</Text>
              </TouchableOpacity>
            </View>

            {/* Starter Store */}
            <View className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
              <View className="flex-row items-center mb-3">
                <Store size={18} color="#7c3aed" className="mr-2" />
                <Text className="text-base font-black text-slate-800 font-sans">বেসিক স্টোর (Starter Store)</Text>
              </View>
              <View className="flex-row items-baseline mb-4">
                <Text className="text-3xl font-black text-slate-800 font-sans">৳50</Text>
                <Text className="text-xs text-slate-500 font-sans ml-1">/ মাস</Text>
              </View>
              
              <View className="space-y-2 mb-6">
                <View className="flex-row items-center mb-2">
                  <CheckCircle2 size={16} color="#10b981" className="mr-2" />
                  <Text className="text-sm text-slate-700 font-sans">পণ্য লিমিট: 500</Text>
                </View>
                <View className="flex-row items-center">
                  <CheckCircle2 size={16} color="#10b981" className="mr-2" />
                  <Text className="text-sm text-slate-700 font-sans">ট্রানজেকশন লিমিট: 1000</Text>
                </View>
              </View>

              <TouchableOpacity className="bg-[#7c3aed] py-3.5 rounded-lg items-center">
                <Text className="text-white font-bold font-sans text-sm">সাবস্ক্রাইব করুন</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export default SettingsScreen;
