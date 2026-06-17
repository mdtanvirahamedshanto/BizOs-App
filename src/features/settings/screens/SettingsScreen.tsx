import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Card } from '@/components/ui/Card';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useAuthStore } from '@/store/auth.store';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { useSyncStore } from '@/features/sync/sync.store';
import { processOutbox } from '@/features/sync/sync-engine';
import { biometrics } from '@/lib/auth/biometrics';

const APP_VERSION = '1.0.0';

function formatRelative(ts: number | null, isBn: boolean): string {
  if (!ts) return isBn ? 'এখনো হয়নি' : 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isBn ? 'এইমাত্র' : 'Just now';
  if (mins < 60) return isBn ? `${mins} মিনিট আগে` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isBn ? `${hrs} ঘণ্টা আগে` : `${hrs} hr ago`;
  return new Date(ts).toLocaleString(isBn ? 'bn-BD' : 'en-US');
}

export function SettingsScreen() {
  const db = SQLite.useSQLiteContext();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { isSyncing, pendingCount, lastSyncAt } = useSyncStore();

  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(biometrics.isEnabledInSettings());

  useEffect(() => {
    void biometrics.isSupported().then(setBioSupported);
  }, []);

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      const ok = await biometrics.authenticate(
        isBn ? 'বায়োমেট্রিক যাচাই করুন' : 'Verify to enable biometric unlock'
      );
      if (!ok) return;
    }
    biometrics.setEnabledInSettings(next);
    setBioEnabled(next);
  };

  const handleSyncNow = () => {
    if (!isOnline) {
      Alert.alert(
        isBn ? 'অফলাইন' : 'Offline',
        isBn ? 'সিঙ্ক করতে ইন্টারনেট সংযোগ প্রয়োজন।' : 'An internet connection is required to sync.'
      );
      return;
    }
    void processOutbox(db);
  };

  const handleLogout = () => {
    Alert.alert(
      isBn ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
      isBn ? 'আপনি কি লগআউট করতে চান?' : 'Are you sure you want to log out?',
      [
        { text: isBn ? 'বাতিল' : 'Cancel', style: 'cancel' },
        { text: isBn ? 'লগআউট' : 'Log Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Profile */}
      <Card variant="elevated" className="mb-4">
        <View className="flex-row items-center">
          <View className="h-12 w-12 rounded-full bg-primary items-center justify-center mr-3">
            <Text className="text-white text-base font-black font-sans">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-slate-800 font-sans">{user?.name || '—'}</Text>
            <Text className="text-[11px] text-slate-450 font-semibold font-sans mt-0.5">{user?.email}</Text>
          </View>
          <View className="bg-primary/10 border border-primary/20 rounded-md px-2 py-1">
            <Text className="text-[9px] font-black text-primary uppercase font-sans">{user?.role}</Text>
          </View>
        </View>
      </Card>

      {/* Language */}
      <Text className="text-[11px] font-black text-slate-450 uppercase tracking-wider mb-2 font-sans">
        {isBn ? 'ভাষা' : 'Language'}
      </Text>
      <LanguageSelector />

      {/* Security */}
      <Text className="text-[11px] font-black text-slate-450 uppercase tracking-wider mb-2 font-sans">
        {isBn ? 'নিরাপত্তা' : 'Security'}
      </Text>
      <Card className="mb-4 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-bold text-slate-700 font-sans">
            {isBn ? 'বায়োমেট্রিক লগইন' : 'Biometric Unlock'}
          </Text>
          <Text className="text-[10px] text-slate-400 font-sans mt-0.5">
            {bioSupported
              ? isBn ? 'ফেস/ফিঙ্গারপ্রিন্ট দিয়ে দ্রুত লগইন' : 'Quick login with Face/Fingerprint'
              : isBn ? 'এই ডিভাইসে সমর্থিত নয়' : 'Not supported on this device'}
          </Text>
        </View>
        <Switch
          value={bioEnabled}
          onValueChange={(v) => void toggleBiometric(v)}
          disabled={!bioSupported}
          trackColor={{ true: '#4f46e5', false: '#cbd5e1' }}
        />
      </Card>

      {/* Sync */}
      <Text className="text-[11px] font-black text-slate-450 uppercase tracking-wider mb-2 font-sans">
        {isBn ? 'সিঙ্ক ও সংযোগ' : 'Sync & Connectivity'}
      </Text>
      <Card className="mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-bold text-slate-700 font-sans">{isBn ? 'সংযোগ অবস্থা' : 'Connection'}</Text>
          <View className={`px-2 py-0.5 rounded-md ${isOnline ? 'bg-success/10' : 'bg-warning/10'}`}>
            <Text className={`text-[10px] font-black font-sans ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOnline ? (isBn ? 'অনলাইন' : 'Online') : (isBn ? 'অফলাইন' : 'Offline')}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-bold text-slate-700 font-sans">{isBn ? 'অপেক্ষমাণ লেনদেন' : 'Pending uploads'}</Text>
          <Text className="text-xs font-black text-slate-800 font-sans">{pendingCount}</Text>
        </View>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-bold text-slate-700 font-sans">{isBn ? 'সর্বশেষ সিঙ্ক' : 'Last sync'}</Text>
          <Text className="text-[11px] font-semibold text-slate-450 font-sans">{formatRelative(lastSyncAt, isBn)}</Text>
        </View>
        <TouchableOpacity
          onPress={handleSyncNow}
          activeOpacity={0.85}
          disabled={isSyncing}
          className="h-11 rounded-xl bg-primary flex-row items-center justify-center"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-white text-xs font-extrabold font-sans">
              {isBn ? 'এখনই সিঙ্ক করুন' : 'Sync Now'}
            </Text>
          )}
        </TouchableOpacity>
      </Card>

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        activeOpacity={0.85}
        className="h-12 rounded-xl bg-rose-50 border border-rose-100 flex-row items-center justify-center mt-2"
      >
        <Text className="text-rose-600 text-xs font-extrabold font-sans">{isBn ? 'লগআউট করুন' : 'Log Out'}</Text>
      </TouchableOpacity>

      <Text className="text-center text-[10px] text-slate-350 font-semibold font-sans mt-6">
        BizOS Mobile • v{APP_VERSION}
      </Text>
    </ScrollView>
  );
}
export default SettingsScreen;
