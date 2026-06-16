import { create } from 'zustand';
import { kvStorage } from '@/lib/storage/mmkv';

export type Language = 'en' | 'bn';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// Initialized language setting, defaulting to Bangla for micro-merchants
const initialLanguage = (kvStorage.getItem('settings.language') as Language) || 'bn';

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage,
  setLanguage: (lang) => {
    kvStorage.setItem('settings.language', lang);
    set({ language: lang });
  },
}));

// Core dictionary covering offline alerts, states, forms, and transactions
const dictionary = {
  en: {
    offline: 'Offline Mode Active',
    online: 'Back Online',
    syncing: 'Syncing outbox data...',
    synced: 'All data synchronized',
    loading: 'Loading data...',
    error: 'Something went wrong',
    retry: 'Retry',
    empty: 'No records found',
    taka: 'Taka',
    cash_in: 'Cash In',
    cash_out: 'Cash Out',
    save: 'Save',
    cancel: 'Cancel',
    amount: 'Amount',
    description: 'Description',
    reference: 'Reference',
    submit: 'Submit',
    success: 'Success',
    username: 'Username',
    password: 'Password',
    login: 'Login',
  },
  bn: {
    offline: 'অফলাইন মোড সক্রিয়',
    online: 'অনলাইন সংযুক্ত হয়েছে',
    syncing: 'ডাটা সিনক্রোনাইজ হচ্ছে...',
    synced: 'সকল ডাটা সেভ হয়েছে',
    loading: 'লোড হচ্ছে...',
    error: 'কোনো সমস্যা হয়েছে',
    retry: 'আবার চেষ্টা করুন',
    empty: 'কোনো তথ্য পাওয়া যায়নি',
    taka: 'টাকা',
    cash_in: 'ক্যাশ ইন',
    cash_out: 'ক্যাশ আউট',
    save: 'সেভ করুন',
    cancel: 'বাতিল',
    amount: 'টাকার পরিমাণ',
    description: 'বিবরণ',
    reference: 'রেফারেন্স',
    submit: 'দাখিল করুন',
    success: 'সফল হয়েছে',
    username: 'ইউজারনেম',
    password: 'পাসওয়ার্ড',
    login: 'লগইন করুন',
  },
};

export type TranslationKey = keyof typeof dictionary['en'];

export function t(key: TranslationKey): string {
  const language = useLanguageStore.getState().language;
  return dictionary[language][key] || key;
}
