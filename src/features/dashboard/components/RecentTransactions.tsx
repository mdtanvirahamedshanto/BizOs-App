import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/utils/translation';
import { RecentTransaction } from '../hooks/use-dashboard-metrics';
import { Clock } from 'lucide-react-native';

interface Props {
  transactions: RecentTransaction[];
}

export function RecentTransactions({ transactions }: Props) {
  if (!transactions || transactions.length === 0) return null;

  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm w-full mb-6">
      <View className="border-b border-slate-100 pb-3 mb-4">
        <Text className="text-sm font-bold text-slate-800 font-sans">
          {t('save') === 'সেভ করুন' ? 'সাম্প্রতিক ট্রানজেকশন' : 'Recent Transactions'}
        </Text>
        <Text className="text-[10px] text-slate-400 font-medium mt-0.5 font-sans">
          {t('save') === 'সেভ করুন' ? 'সর্বশেষ বিক্রয় এবং খরচের তালিকা' : 'Latest sales and expenses'}
        </Text>
      </View>

      <View className="space-y-3">
        {transactions.map((tx) => (
          <View key={tx.id} className="flex-row items-center justify-between border-b border-slate-50 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0">
            <View className="flex-row items-center flex-1 pr-3">
              <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 ${tx.type === 'sale' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <Text className={`text-sm font-bold ${tx.type === 'sale' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {tx.type === 'sale' ? '+' : '-'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-800 font-sans" numberOfLines={1}>
                  {tx.customerName}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text className="text-[10px] text-slate-400 font-sans mr-2">#{tx.invoiceNo}</Text>
                  <Clock size={10} color="#94a3b8" />
                  <Text className="text-[9px] text-slate-400 font-sans ml-1">
                    {new Date(tx.timestamp).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            </View>

            <View className="items-end">
              <Text className={`text-xs font-bold font-sans ${tx.type === 'sale' ? 'text-slate-800' : 'text-rose-600'}`}>
                ৳ {(tx.amount / 100).toLocaleString('bn-BD')}
              </Text>
              <View className="mt-1">
                <Badge
                  label={tx.paymentStatus === 'paid' ? (t('save') === 'সেভ করুন' ? 'পেইড' : 'Paid') : (tx.paymentStatus === 'unpaid' ? (t('save') === 'সেভ করুন' ? 'বাকি' : 'Unpaid') : 'Partial')}
                  variant={tx.paymentStatus === 'paid' ? 'success' : tx.paymentStatus === 'unpaid' ? 'destructive' : 'warning'}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
