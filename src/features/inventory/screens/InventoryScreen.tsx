import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, RefreshControl } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { useLanguageStore } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { productsApi, Product, StockAdjustmentType } from '@/lib/api/modules/products.api';
import { pullProducts } from '@/features/sync/pull-sync';
import { useSyncStore } from '@/features/sync/sync.store';
import { newId } from '@/lib/id';

const ADJUST_TYPES: { type: StockAdjustmentType; bn: string; en: string }[] = [
  { type: 'IN', bn: 'স্টক জমা', en: 'Stock In' },
  { type: 'OUT', bn: 'স্টক খরচ', en: 'Stock Out' },
  { type: 'DAMAGE', bn: 'ক্ষতি', en: 'Damage' },
];

export function InventoryScreen() {
  const db = SQLite.useSQLiteContext();
  const isBn = useLanguageStore((s) => s.language) === 'bn';
  const isOnline = useNetworkStore((s) => s.isOnline);
  const setPendingCount = useSyncStore((s) => s.setPendingCount);

  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const [selected, setSelected] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockAdjustmentType>('IN');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      let query =
        'SELECT id, sku, barcode, name, stock, priceCents, costPriceCents, lowStockThreshold, lastUpdated FROM products';
      let params: any[] = [];
      if (search.trim()) {
        query += ' WHERE name LIKE ? OR sku LIKE ? OR barcode = ?';
        params = [`%${search}%`, `%${search}%`, search.trim()];
      }
      query += ' ORDER BY name ASC LIMIT 200';
      const rows = await db.getAllAsync<Product>(query, params);
      setProducts(rows);
    } catch (err) {
      console.error('[Inventory] Load failure:', err);
    }
  }, [db, search]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        const count = await pullProducts(db);
        if (count >= 0) {
          await loadProducts();
        }
      } else {
        Alert.alert(
          isBn ? 'অফলাইন' : 'Offline',
          isBn ? 'সর্বশেষ স্টক পেতে ইন্টারনেট প্রয়োজন।' : 'Internet is required to refresh stock.'
        );
      }
    } catch (err) {
      console.warn('[Inventory] Refresh failed:', (err as Error)?.message);
    } finally {
      setRefreshing(false);
    }
  }, [db, isOnline, isBn, loadProducts]);

  const openAdjust = (product: Product) => {
    setSelected(product);
    setAdjustType('IN');
    setQty('');
    setNotes('');
  };

  const queueStockAdjust = async (
    adjustId: string,
    productId: string,
    type: StockAdjustmentType,
    quantity: number,
    note: string,
  ) => {
    await db.runAsync(
      `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [
        adjustId,
        'STOCK_ADJUST',
        JSON.stringify({ id: adjustId, productId, type, quantity, notes: note || undefined }),
        0,
        Date.now(),
      ]
    );
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox');
    setPendingCount(row?.count ?? 0);
  };

  const submitAdjust = async () => {
    if (!selected) return;
    const quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'সঠিক পরিমাণ লিখুন।' : 'Enter a valid quantity.');
      return;
    }
    const delta = adjustType === 'IN' ? quantity : -quantity;
    const newStock = selected.stock + delta;
    if (newStock < 0) {
      Alert.alert(
        isBn ? 'স্টক ঘাটতি' : 'Insufficient Stock',
        isBn ? 'স্টকের চেয়ে বেশি খরচ করা যাবে না।' : 'Cannot remove more than available stock.'
      );
      return;
    }

    setSaving(true);
    // Stable id reused for the online attempt and any offline retry so the
    // server applies this stock movement exactly once (idempotency key).
    const adjustId = newId();
    try {
      // 1. Apply to local cache immediately (offline-first).
      await db.runAsync('UPDATE products SET stock = ?, lastUpdated = ? WHERE id = ?', [
        newStock,
        Date.now(),
        selected.id,
      ]);

      // 2. Push to backend, or queue for later.
      let offline = !isOnline;
      if (isOnline) {
        try {
          await productsApi.adjustStock(
            selected.id,
            { type: adjustType, quantity, notes: notes || undefined },
            adjustId,
          );
        } catch {
          await queueStockAdjust(adjustId, selected.id, adjustType, quantity, notes);
          offline = true;
        }
      } else {
        await queueStockAdjust(adjustId, selected.id, adjustType, quantity, notes);
      }

      setSelected(null);
      await loadProducts();
      Alert.alert(
        offline ? (isBn ? 'অফলাইন সেভ' : 'Saved Offline') : (isBn ? 'সফল' : 'Success'),
        offline
          ? isBn ? 'স্টক পরিবর্তন অফলাইনে সেভ হয়েছে এবং সিঙ্ক হবে।' : 'Stock change saved offline and will sync.'
          : isBn ? 'স্টক হালনাগাদ হয়েছে।' : 'Stock updated.'
      );
    } catch (err) {
      console.error('[Inventory] Adjust failure:', err);
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'স্টক পরিবর্তন ব্যর্থ হয়েছে।' : 'Stock adjustment failed.');
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 10)).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Search + scan */}
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <View className="flex-row items-start">
          <View className="flex-1">
            <Input
              placeholder={isBn ? 'নাম, SKU বা বারকোড খুঁজুন...' : 'Search name, SKU or barcode...'}
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
            />
          </View>
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.85}
            className="h-12 w-12 ml-2 rounded-xl bg-primary items-center justify-center"
          >
            <Text style={{ fontSize: 18 }}>📷</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-[10px] text-slate-450 font-sans">
            {products.length} {isBn ? 'টি পণ্য' : 'products'}
          </Text>
          {lowStockCount > 0 && (
            <Text className="text-[10px] font-bold text-amber-700 font-sans">
              {lowStockCount} {isBn ? 'টি কম স্টক' : 'low stock'}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        {products.length === 0 ? (
          <Text className="text-center text-xs text-slate-400 mt-10 font-sans">
            {isBn ? 'কোনো পণ্য পাওয়া যায়নি। রিফ্রেশ করে সিঙ্ক করুন।' : 'No products. Pull down to sync from server.'}
          </Text>
        ) : (
          products.map((p) => {
            const low = p.stock <= (p.lowStockThreshold ?? 10);
            return (
              <Card key={p.id} variant="clickable" onPress={() => openAdjust(p)} style={{ marginBottom: 10 }}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-black text-slate-800 font-sans" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="text-[10px] text-slate-400 font-mono mt-0.5">
                      SKU: {p.sku}{p.barcode ? `  •  ${p.barcode}` : ''}
                    </Text>
                    <Text className="text-sm font-extrabold text-primary font-sans mt-1">
                      ৳{(p.priceCents / 100).toFixed(2)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className={`text-base font-black font-sans ${low ? 'text-amber-700' : 'text-slate-800'}`}>
                      {p.stock}
                    </Text>
                    <Text className="text-[9px] text-slate-400 font-sans">{isBn ? 'স্টক' : 'in stock'}</Text>
                    {low && <Badge label={isBn ? 'কম স্টক' : 'Low'} variant="warning" />}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Stock adjust modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <View className="bg-white rounded-t-3xl p-6 border-t border-slate-100">
            <Text className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 font-sans" numberOfLines={1}>
              {isBn ? 'স্টক সমন্বয়' : 'Adjust Stock'} — {selected?.name}
            </Text>

            <Text className="text-[11px] font-bold text-slate-500 font-sans mb-2">
              {isBn ? 'বর্তমান স্টক: ' : 'Current stock: '}{selected?.stock}
            </Text>

            {/* Type chips */}
            <View className="flex-row mb-3">
              {ADJUST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.type}
                  onPress={() => setAdjustType(t.type)}
                  activeOpacity={0.85}
                  className={`flex-1 items-center py-2.5 rounded-xl border mr-2 ${
                    adjustType === t.type ? 'bg-primary-50 border-primary' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`text-[11px] font-extrabold font-sans ${adjustType === t.type ? 'text-primary' : 'text-slate-500'}`}>
                    {isBn ? t.bn : t.en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={isBn ? 'পরিমাণ' : 'Quantity'}
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              placeholder="0"
            />
            <Input
              label={isBn ? 'নোট (ঐচ্ছিক)' : 'Notes (optional)'}
              value={notes}
              onChangeText={setNotes}
              placeholder={isBn ? 'কারণ লিখুন' : 'Reason'}
            />

            <View className="flex-row justify-between pt-2">
              <TouchableOpacity onPress={() => setSelected(null)} className="px-5 py-3 rounded-xl bg-slate-100 active:bg-slate-200">
                <Text className="text-slate-600 text-xs font-bold font-sans">{isBn ? 'বাতিল' : 'Cancel'}</Text>
              </TouchableOpacity>
              <View className="flex-1 ml-4">
                <Button label={isBn ? 'সংরক্ষণ' : 'Save'} onPress={() => void submitAdjust()} loading={saving} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          setSearch(code);
          setScannerVisible(false);
        }}
      />
    </View>
  );
}
export default InventoryScreen;
