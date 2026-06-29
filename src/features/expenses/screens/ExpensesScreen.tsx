import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wallet, Plus } from 'lucide-react-native';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { expensesApi, Expense, ExpenseCategory } from '@/lib/api/modules/expenses.api';

export function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const db = SQLite.useSQLiteContext();
  const { language } = useLanguageStore();
  const isBn = language === 'bn';
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [expenses, setExpenses] = useState<(Expense & { categoryName?: string })[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const cats = await expensesApi.listCategories(db);
      setCategories(cats);

      const rows = await db.getAllAsync<Expense>(
        'SELECT * FROM expenses ORDER BY createdAt DESC LIMIT 50'
      );
      
      const enrichedRows = rows.map(exp => ({
        ...exp,
        categoryName: cats.find(c => c.id === exp.categoryId)?.name
      }));
      
      setExpenses(enrichedRows);
    } catch (err) {
      console.error('[Expenses] SQLite fetch error:', err);
    }
  }, [db]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        // Sync expenses logic would go here
        await loadData();
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, loadData]);

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 16) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center space-x-3">
            <View className="p-3 bg-rose-100 rounded-2xl">
              <Wallet size={24} color="#e11d48" />
            </View>
            <View>
              <Text className="text-2xl font-bold text-slate-800">
                {isBn ? 'খরচের খাতা' : 'Expenses'}
              </Text>
              <Text className="text-slate-500 text-sm">
                {isBn ? 'দৈনন্দিন ব্যবসার খরচ' : 'Daily business expenses'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity className="bg-rose-600 w-12 h-12 rounded-full items-center justify-center shadow-lg shadow-rose-600/30">
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {expenses.map((expense) => (
          <Card key={expense.id} className="mb-4">
            <View className="flex-row justify-between items-start mb-2">
              <View>
                <Text className="text-lg font-semibold text-slate-800">
                  {expense.title}
                </Text>
                {expense.categoryName && (
                  <Text className="text-sm text-slate-500 mt-1">
                    {expense.categoryName}
                  </Text>
                )}
              </View>
              <Text className="text-lg font-bold text-rose-600">
                -৳{(expense.amountCents / 100).toFixed(2)}
              </Text>
            </View>
            
            <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-100">
              <Text className="text-xs text-slate-400">
                {new Date(expense.createdAt).toLocaleDateString()} • {expense.paymentMethod}
              </Text>
              
              {!expense.isSynced && (
                <Badge variant="neutral" label="Offline" />
              )}
            </View>
          </Card>
        ))}

        {expenses.length === 0 && (
          <View className="items-center justify-center py-12">
            <Wallet size={48} color="#cbd5e1" className="mb-4" />
            <Text className="text-lg font-medium text-slate-400">
              {isBn ? 'কোনো খরচের রেকর্ড নেই' : 'No expense records'}
            </Text>
          </View>
        )}
        
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}
