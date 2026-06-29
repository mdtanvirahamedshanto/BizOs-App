import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, RefreshControl, TextInput } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { Package, Barcode, Tag, Building2, DollarSign, Boxes, Scale, LayoutList, Layers, Plus, X } from 'lucide-react-native';
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
  const insets = useSafeAreaInsets();
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

  // Add Product Modal State
  const [addProductVisible, setAddProductVisible] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', barcode: '', sku: '', costPrice: '', salePrice: '', stock: '', unit: 'Pcs (Pcs)', category: '', brand: ''
  });

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

  const handleSaveNewProduct = async () => {
    const { name, sku, barcode, costPrice, salePrice, stock } = newProduct;
    if (!name || !costPrice || !salePrice || !stock) {
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'সব বাধ্যতামূলক ফিল্ড পূরণ করুন।' : 'Please fill all required fields.');
      return;
    }
    const costCents = Math.round(parseFloat(costPrice) * 100);
    const saleCents = Math.round(parseFloat(salePrice) * 100);
    const stockQty = parseInt(stock, 10);
    
    if (isNaN(costCents) || isNaN(saleCents) || isNaN(stockQty)) {
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'সংখ্যাবাচক মান দিন।' : 'Enter valid numeric values.');
      return;
    }

    setSaving(true);
    const newProdId = newId();
    try {
      // Offline-first: save locally
      await db.runAsync(
        'INSERT INTO products (id, sku, barcode, name, stock, priceCents, costPriceCents, lastUpdated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newProdId, sku || `SKU-${Date.now()}`, barcode || null, name, stockQty, saleCents, costCents, Date.now()]
      );

      let offline = !isOnline;
      if (isOnline) {
        try {
          await productsApi.createProduct({
            name,
            sku: sku || `SKU-${Date.now()}`,
            barcode: barcode || null,
            sellPriceCents: saleCents,
            costPriceCents: costCents,
            stockQuantity: stockQty
          }, newProdId);
        } catch {
          offline = true;
        }
      }

      if (offline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [
            newProdId,
            'PRODUCT_CREATE',
            JSON.stringify({ id: newProdId, name, sku, barcode, sellPriceCents: saleCents, costPriceCents: costCents, stockQuantity: stockQty }),
            0,
            Date.now(),
          ]
        );
        const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox');
        setPendingCount(row?.count ?? 0);
      }

      setAddProductVisible(false);
      setNewProduct({ name: '', barcode: '', sku: '', costPrice: '', salePrice: '', stock: '', unit: 'Pcs (Pcs)', category: '', brand: '' });
      await loadProducts();

      Alert.alert(
        offline ? (isBn ? 'অফলাইন সেভ' : 'Saved Offline') : (isBn ? 'সফল' : 'Success'),
        offline ? (isBn ? 'প্রোডাক্ট সেভ হয়েছে এবং অনলাইনে সিঙ্ক হবে।' : 'Product saved offline.') : (isBn ? 'প্রোডাক্ট সফলভাবে যোগ হয়েছে।' : 'Product added successfully.')
      );

    } catch (err) {
      console.error('[Inventory] Add Product failed:', err);
      Alert.alert(isBn ? 'ত্রুটি' : 'Error', isBn ? 'প্রোডাক্ট সংরক্ষণ ব্যর্থ হয়েছে।' : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 10)).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Search + scan */}
      <View style={{ padding: 16, paddingTop: Math.max(insets.top, 16), backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
        <View className="flex-row items-center mb-3">
          <View className="flex-1 bg-white border border-slate-200 rounded-lg flex-row items-center px-3 h-12 shadow-sm">
            <Tag color="#94a3b8" size={18} />
            <TextInput
              placeholder={isBn ? 'নাম, SKU বা বারকোড খুঁজুন...' : 'Search name, SKU or barcode...'}
              value={search}
              onChangeText={setSearch}
              className="flex-1 text-sm text-slate-800 font-sans ml-2 h-full"
              placeholderTextColor="#94a3b8"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} className="p-1">
                <X color="#94a3b8" size={16} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.85}
            className="h-12 w-12 ml-2 rounded-xl bg-[#7c3aed] items-center justify-center shadow-sm"
          >
            <Barcode color="#ffffff" size={20} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => setAddProductVisible(true)}
          className="bg-primary-50 border border-primary-200 rounded-lg py-3 flex-row items-center justify-center mb-2"
        >
          <Plus color="#7c3aed" size={18} className="mr-2" />
          <Text className="text-[#7c3aed] font-bold text-sm font-sans">{isBn ? 'নতুন প্রোডাক্ট যোগ করুন' : 'Add New Product'}</Text>
        </TouchableOpacity>
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
          <View className="items-center justify-center py-10">
            <Package color="#cbd5e1" size={48} className="mb-4" />
            <Text className="text-center text-xs text-slate-400 font-sans">
              {isBn ? 'কোনো পণ্য পাওয়া যায়নি। রিফ্রেশ করে সিঙ্ক করুন।' : 'No products. Pull down to sync from server.'}
            </Text>
          </View>
        ) : (
          products.map((p) => {
            const low = p.stock <= (p.lowStockThreshold ?? 10);
            return (
              <TouchableOpacity key={p.id} onPress={() => openAdjust(p)} activeOpacity={0.7} className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-sm">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-black text-slate-800 font-sans mb-1" numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text className="text-[10px] text-slate-400 font-sans mb-2">
                      SKU: {p.sku}{p.barcode ? `  •  ${p.barcode}` : ''}
                    </Text>
                    <Text className="text-sm font-extrabold text-[#7c3aed] font-sans">
                      ৳{(p.priceCents / 100).toFixed(0)}
                    </Text>
                  </View>
                  <View className="items-end bg-slate-50 border border-slate-100 p-2 rounded-lg min-w-[70px]">
                    <Text className={`text-base font-black font-sans ${low ? 'text-amber-600' : 'text-slate-700'}`}>
                      {p.stock}
                    </Text>
                    <Text className="text-[9px] text-slate-400 font-sans">{isBn ? 'স্টক আছে' : 'In Stock'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add New Product Modal */}
      <Modal visible={addProductVisible} transparent animationType="slide" onRequestClose={() => setAddProductVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View className="bg-white h-[92%] rounded-t-3xl shadow-2xl overflow-hidden flex-col">
            
            <View className="bg-white px-5 pb-3 pt-4 border-b border-slate-100 flex-row items-center justify-between shrink-0">
              <View>
                <Text className="text-base font-black text-slate-800 font-sans">{isBn ? 'নতুন প্রোডাক্ট যোগ করুন' : 'Add New Product'}</Text>
                <Text className="text-[10px] font-bold text-slate-400 font-sans mt-1">Add New Item to Inventory</Text>
              </View>
              <TouchableOpacity onPress={() => setAddProductVisible(false)} className="p-2 bg-slate-50 rounded-full">
                <X color="#94a3b8" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-5">
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">প্রোডাক্টের নাম <Text className="text-red-500">*</Text></Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Package color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="যেমন: তীর সয়াবিন তেল ৫ লিটার" value={newProduct.name} onChangeText={(t) => setNewProduct({...newProduct, name: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">বারকোড (Barcode)</Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Barcode color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="স্ক্যান করুন বা কোড লিখুন" value={newProduct.barcode} onChangeText={(t) => setNewProduct({...newProduct, barcode: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">এসকেইউ (SKU Code)</Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Tag color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="যেমন: OIL-SOY-5" value={newProduct.sku} onChangeText={(t) => setNewProduct({...newProduct, sku: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">ক্রয় মূল্য (Cost Price) <Text className="text-red-500">*</Text></Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Building2 color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="0.00" keyboardType="numeric" value={newProduct.costPrice} onChangeText={(t) => setNewProduct({...newProduct, costPrice: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">বিক্রয় মূল্য (Sale Price) <Text className="text-red-500">*</Text></Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <DollarSign color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="0.00" keyboardType="numeric" value={newProduct.salePrice} onChangeText={(t) => setNewProduct({...newProduct, salePrice: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">প্রারম্ভিক স্টক (Stock Qty) <Text className="text-red-500">*</Text></Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Boxes color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="0" keyboardType="numeric" value={newProduct.stock} onChangeText={(t) => setNewProduct({...newProduct, stock: t})} />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">পরিমাপের একক <Text className="text-red-500">*</Text></Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12 justify-between">
                  <View className="flex-row items-center">
                    <Scale color="#94a3b8" size={18} />
                    <Text className="ml-2 text-xs font-sans text-slate-800">{newProduct.unit}</Text>
                  </View>
                  <Text className="text-slate-400">▼</Text>
                </View>
              </View>

              <View className="mb-4">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs font-bold text-slate-700 font-sans">প্রোডাক্ট ক্যাটাগরি</Text>
                  <Text className="text-xs font-bold text-[#7c3aed] font-sans">+ নতুন ক্যাটাগরি</Text>
                </View>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12 justify-between">
                  <View className="flex-row items-center">
                    <LayoutList color="#94a3b8" size={18} />
                    <Text className="ml-2 text-xs font-sans text-slate-400">নির্বাচন করুন</Text>
                  </View>
                  <Text className="text-slate-400">▼</Text>
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">ব্র্যান্ড (Brand)</Text>
                <View className="flex-row items-center border border-slate-200 rounded-lg px-3 bg-white h-12">
                  <Layers color="#94a3b8" size={18} />
                  <TextInput className="flex-1 ml-2 text-xs font-sans text-slate-800" placeholder="যেমন: ফ্রেশ, তীর, স্কয়ার" value={newProduct.brand} onChangeText={(t) => setNewProduct({...newProduct, brand: t})} />
                </View>
              </View>

              <View className="flex-row justify-end pt-4 border-t border-slate-100 mb-20 space-x-3">
                <TouchableOpacity onPress={() => setAddProductVisible(false)} className="px-6 py-3 border border-slate-200 rounded-xl">
                  <Text className="text-slate-600 text-xs font-bold font-sans">বাতিল করুন</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveNewProduct} disabled={saving} className="px-6 py-3 bg-[#7c3aed] rounded-xl ml-3">
                  <Text className="text-white text-xs font-bold font-sans">{saving ? 'অপেক্ষা করুন...' : 'প্রোডাক্ট সংরক্ষণ'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
