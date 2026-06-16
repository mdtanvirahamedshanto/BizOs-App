import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { salesApi, SaleItemInput, SaleInput } from '@/lib/api/modules/sales.api';
import { productsApi, Product } from '@/lib/api/modules/products.api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/utils/translation';

interface CartItem {
  product: Product;
  quantity: number;
}

export function PosScreen() {
  const db = SQLite.useSQLiteContext();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountCents, setDiscountCents] = useState('0');
  const [taxCents, setTaxCents] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'DUE' | 'PARTIAL'>('PAID');
  const [loading, setLoading] = useState(false);

  // Fetch catalog products from SQLite local cache database
  const searchProducts = useCallback(async () => {
    try {
      let query = 'SELECT id, sku, name, stock, priceCents, lastUpdated FROM products';
      let params: any[] = [];
      
      if (search.trim()) {
        query += ' WHERE name LIKE ? OR sku = ?';
        params = [`%${search}%`, search];
      }
      
      const rows = await db.getAllAsync<Product>(query, params);
      setProducts(rows);
    } catch (err) {
      console.error('[POS] Database fetch failure:', err);
    }
  }, [db, search]);

  useEffect(() => {
    void searchProducts();
  }, [searchProducts]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('আউট অফ স্টক / Out of Stock', 'এই প্রোডাক্টটির পর্যাপ্ত স্টক নেই।');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert('স্টক সীমাবদ্ধতা / Stock Alert', 'ইনভেন্টরি স্টকের চেয়ে বেশি সিলেক্ট করা যাবে না।');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      
      const newQty = item.quantity + amount;
      if (newQty <= 0) {
        return prev.filter((i) => i.product.id !== productId);
      }
      if (newQty > item.product.stock) {
        Alert.alert('স্টক সীমাবদ্ধতা / Stock Alert', 'স্টক ছাড়িয়ে যাচ্ছে।');
        return prev;
      }
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i));
    });
  };

  // Cart total calculations
  const subtotalCents = cart.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const discountVal = parseFloat(discountCents) || 0;
  const taxVal = parseFloat(taxCents) || 0;
  const finalTotalCents = Math.max(0, subtotalCents - discountVal + taxVal);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('খালি কার্ট / Empty Cart', 'কার্টে অন্তত একটি প্রোডাক্ট যুক্ত করুন।');
      return;
    }

    setLoading(true);
    try {
      const saleId = Math.random().toString(); // Pre-generate transaction UUID

      const itemsInput: SaleItemInput[] = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        priceCents: item.product.priceCents,
      }));

      const payload: SaleInput = {
        id: saleId,
        items: itemsInput,
        totalCents: finalTotalCents,
        taxCents: Math.round(taxVal),
        discountCents: Math.round(discountVal),
        paymentStatus,
        createdAt: Date.now(),
      };

      // Execute POS checkout via Sales API module (automatically enqueues in outbox if connection drops)
      const isOfflineMode = true; // Test mode simulation
      const result = await salesApi.createSale(db, payload, isOfflineMode);

      setLoading(false);
      setCart([]);
      setDiscountCents('0');
      setTaxCents('0');
      void searchProducts(); // Reload stock count changes

      Alert.alert(
        result.offline ? 'অফলাইন সেভ / Saved Offline' : 'সফল হয়েছে / Success',
        result.offline 
          ? 'বিক্রয়টি অফলাইনে সেভ করা হয়েছে এবং সংযোগ পেলে সিঙ্ক হবে।'
          : 'বিক্রয়টি সার্ভারে রেকর্ড করা হয়েছে।'
      );
    } catch (err) {
      setLoading(false);
      Alert.alert('ত্রুটি / Error', 'চেকআউট সম্পন্ন করা সম্ভব হয়নি।');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      
      {/* 1. Header Search Area */}
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
        <Input
          placeholder="বারকোড স্ক্যান করুন বা প্রোডাক্টের নাম খুঁজুন..."
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Left Side: Product Catalog List Grid */}
        <ScrollView style={{ flex: 1.2, padding: 10 }}>
          {products.length === 0 ? (
            <Text className="text-center text-xs text-slate-400 mt-6 font-sans">কোনো প্রোডাক্ট পাওয়া যায়নি</Text>
          ) : (
            products.map((product) => (
              <Card
                key={product.id}
                variant="clickable"
                onPress={() => addToCart(product)}
                style={{ marginBottom: 10 }}
              >
                <Text className="text-xs font-black text-slate-800 font-sans">{product.name}</Text>
                <Text className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {product.sku}</Text>
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-sm font-extrabold text-primary font-sans">
                    ৳{(product.priceCents / 100).toFixed(2)}
                  </Text>
                  <Badge
                    label={`${product.stock} units`}
                    variant={product.stock < 10 ? 'warning' : 'success'}
                  />
                </View>
              </Card>
            ))
          )}
        </ScrollView>

        {/* Right Side: Selected Cart Items Panel */}
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: '#cbd5e1', backgroundColor: '#ffffff', padding: 10 }}>
          <Text className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wider mb-2 font-sans">
            কার্ট তালিকা / Cart
          </Text>

          <ScrollView style={{ flex: 1 }}>
            {cart.length === 0 ? (
              <Text className="text-center text-[10px] text-slate-400 mt-8 font-sans">কার্ট খালি</Text>
            ) : (
              cart.map((item) => (
                <View key={item.product.id} className="border-b border-slate-100 pb-2 mb-2">
                  <Text className="text-[11px] font-bold text-slate-700 font-sans" numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <View className="flex-row items-center justify-between mt-1">
                    <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-md">
                      <TouchableOpacity onPress={() => updateQuantity(item.product.id, -1)} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text className="text-xs font-bold text-slate-500">-</Text>
                      </TouchableOpacity>
                      <Text className="text-xs font-extrabold text-slate-700 px-2 font-sans">{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.product.id, 1)} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text className="text-xs font-bold text-slate-500">+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text className="text-xs font-extrabold text-slate-850 font-sans">
                      ৳{((item.product.priceCents * item.quantity) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Checkout calculation summary area */}
          <View className="border-t border-slate-200 pt-3 space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-[10px] text-slate-400 font-bold font-sans">সাবটোটাল / Subtotal</Text>
              <Text className="text-xs font-extrabold text-slate-650 font-sans">
                ৳{(subtotalCents / 100).toFixed(2)}
              </Text>
            </View>

            {/* Total calculation triggered triggers */}
            <View className="flex-row justify-between items-center">
              <Text className="text-[10px] text-slate-400 font-bold font-sans">ডিসকাউন্ট (৳)</Text>
              <TextInput
                value={discountCents}
                onChangeText={setDiscountCents}
                keyboardType="numeric"
                className="w-16 h-7 border border-slate-200 rounded px-1.5 text-right text-[10px] font-sans font-bold text-slate-800"
              />
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-[10px] text-slate-400 font-bold font-sans">ভ্যাট / ভাউচার (৳)</Text>
              <TextInput
                value={taxCents}
                onChangeText={setTaxCents}
                keyboardType="numeric"
                className="w-16 h-7 border border-slate-200 rounded px-1.5 text-right text-[10px] font-sans font-bold text-slate-800"
              />
            </View>

            {/* Payment status selector */}
            <View className="flex-row justify-between items-center pt-1">
              <TouchableOpacity
                onPress={() => setPaymentStatus('PAID')}
                className={`px-2 py-1 rounded ${paymentStatus === 'PAID' ? 'bg-primary-50 border border-primary/20' : ''}`}
              >
                <Text className={`text-[9px] font-bold ${paymentStatus === 'PAID' ? 'text-primary' : 'text-slate-400'}`}>নগদ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPaymentStatus('DUE')}
                className={`px-2 py-1 rounded ${paymentStatus === 'DUE' ? 'bg-amber-50 border border-amber-250' : ''}`}
              >
                <Text className={`text-[9px] font-bold ${paymentStatus === 'DUE' ? 'text-amber-700' : 'text-slate-400'}`}>বাকি</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-between pt-2 border-t border-slate-100">
              <Text className="text-xs font-black text-slate-800 font-sans">সর্বমোট / Total</Text>
              <Text className="text-base font-black text-primary font-sans">
                ৳{(finalTotalCents / 100).toFixed(2)}
              </Text>
            </View>

            <View style={{ marginTop: 8 }}>
              <Button
                label={t('submit')}
                onPress={handleCheckout}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
export default PosScreen;
