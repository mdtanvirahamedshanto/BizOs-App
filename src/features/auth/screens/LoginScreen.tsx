import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../hooks/use-auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { t } from '@/utils/translation';
import { biometrics } from '@/lib/auth/biometrics';

// Validation constraints combining Bengali and English warnings
const schema = z.object({
  email: z.string().email('সঠিক ইমেইল লিখুন / Enter a valid email'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে / Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export function LoginScreen() {
  const { login, isPending, performBiometricLogin } = useAuth();
  const [showBioBtn, setShowBioBtn] = useState(false);

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    // Check if hardware supports biometrics and configuration toggle is enabled
    void biometrics.isSupported().then((supported) => {
      if (supported && biometrics.isEnabledInSettings()) {
        setShowBioBtn(true);
        // Automatically prompt quick biometric authentication on screen load
        void performBiometricLogin();
      }
    });
  }, [performBiometricLogin]);

  const onSubmit = (data: FormData) => {
    login(data, {
      onError: (err) => {
        Alert.alert('লগইন ব্যর্থ / Login Failed', err.message || 'সঠিক তথ্য প্রদান করুন।');
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-sm mx-auto">
        
        {/* Brand Icon Header */}
        <View className="items-center mb-6">
          <Text className="text-3xl font-black text-slate-800 tracking-tight font-sans">BizOS</Text>
          <Text className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider font-sans">
            Smart SME Operating System
          </Text>
        </View>

        {/* Translation Selector Panel */}
        <LanguageSelector />

        {/* Auth form sheet container */}
        <View className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
          
          {/* Email input field */}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('username')}
                value={value}
                onChangeText={onChange}
                onClear={() => setValue('email', '')}
                error={errors.email?.message}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="owner@shop.com"
              />
            )}
          />

          {/* Password input field */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('password')}
                value={value}
                onChangeText={onChange}
                onClear={() => setValue('password', '')}
                error={errors.password?.message}
                secureTextEntry
                placeholder="******"
              />
            )}
          />

          {/* Action trigger button */}
          <View style={{ marginTop: 16 }}>
            <Button
              label={t('login')}
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
            />
          </View>

          {/* Biometrics quick access */}
          {showBioBtn && (
            <TouchableOpacity
              onPress={performBiometricLogin}
              activeOpacity={0.8}
              style={{ marginTop: 12, padding: 12 }}
              className="flex-row items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 active:bg-primary/10"
            >
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔒</Text>
              <Text className="text-xs font-bold text-primary font-sans">
                বায়োমেট্রিক লগইন (Biometric Unlock)
              </Text>
            </TouchableOpacity>
          )}

          </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default LoginScreen;
