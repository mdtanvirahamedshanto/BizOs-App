import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { salesApi, SaleItemInput, SaleInput } from '@/lib/api/modules/sales.api';
import { productsApi, Product } from '@/lib/api/modules/products.api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ShoppingCart, ChevronUp, X, ScanBarcode, Maximize, Trash2, UserCircle } from 'lucide-react-native';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { t } from '@/utils/translation';
import { useNetworkStore } from '@/lib/network/network.store';
import { newId } from '@/lib/id';

interface CartItem {
  product: Product;
  quantity: number;
}

export function PosScreen() {
  const insets = useSafeAreaInsets();
  const db = SQLite.useSQLiteContext();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountCents, setDiscountCents] = useState('0');
  const [taxCents, setTaxCents] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'DUE' | 'PARTIAL'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MFS'>('CASH');
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'sale' | 'return'>('sale');

  // Fetch catalog products from SQLite local cache database
  const searchProducts = useCallback(async () => {
    try {
      let query = 'SELECT id, sku, name, stock, priceCents, lastUpdated FROM products';
      let params: any[] = [];
      
      if (search.trim()) {
        query += ' WHERE name LIKE ? OR sku = ? OR barcode = ?';
        params = [`%${search}%`, search.trim(), search.trim()];
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

  // Resolve a scanned barcode to a product (matched against SKU) and add to cart.
  const resolveBarcode = useCallback(
    async (code: string) => {
      try {
        const product = await db.getFirstAsync<Product>(
          'SELECT id, sku, barcode, name, stock, priceCents, lastUpdated FROM products WHERE barcode = ? OR sku = ? LIMIT 1',
          [code, code]
        );
        if (!product) {
          setScanFeedback(`❌ ${code}`);
          return;
        }
        if (product.stock <= 0) {
          setScanFeedback(`⚠️ ${product.name}`);
          return;
        }
        addToCart(product);
        setScanFeedback(`✓ ${product.name}`);
      } catch (err) {
        console.error('[POS] Barcode lookup failure:', err);
      }
    },
    [db]
  );

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

  const setExactQuantity = (productId: string, qty: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      if (qty < 0) return prev;
      if (qty > item.product.stock) {
        Alert.alert('স্টক সীমাবদ্ধতা / Stock Alert', 'স্টক ছাড়িয়ে যাচ্ছে।');
        return prev.map((i) => (i.product.id === productId ? { ...i, quantity: item.product.stock } : i));
      }
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i));
    });
  };

  const setItemPrice = (productId: string, priceCents: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, product: { ...i.product, priceCents } }
          : i
      )
    );
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
      const saleId = newId(); // Pre-generate stable sale id + idempotency key

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
      const result = await salesApi.createSale(db, payload, !isOnline);

      setLoading(false);
      setCart([]);
      setDiscountCents('0');
      setTaxCents('0');
      setCheckoutVisible(false);
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

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      
      {/* Header & Tabs */}
      <View className="bg-white px-4 pb-2 border-b border-slate-100" style={{ paddingTop: Math.max(insets.top, 16) }}>
        <Text className="text-xl font-black text-slate-800 font-sans tracking-tight">
          পয়েন্ট অব সেলস (POS)
        </Text>
        <Text className="text-xs text-slate-500 font-semibold font-sans mt-0.5 mb-4">
          দ্রুত কাউন্টার বিক্রয় ও ক্যাশ মেমো চালান সম্পন্ন করুন
        </Text>

        <View className="flex-row items-center border border-slate-200 rounded-lg p-1 mb-2">
          <TouchableOpacity
            onPress={() => setActiveTab('sale')}
            className={`flex-1 py-2 rounded-md items-center justify-center ${activeTab === 'sale' ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
          >
            <Text className={`text-xs font-bold font-sans ${activeTab === 'sale' ? 'text-white' : 'text-slate-600'}`}>
              নতুন বিক্রি (New Sale)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('return')}
            className={`flex-1 py-2 rounded-md items-center justify-center ${activeTab === 'return' ? 'bg-[#7c3aed]' : 'bg-transparent'}`}
          >
            <Text className={`text-xs font-bold font-sans ${activeTab === 'return' ? 'text-white' : 'text-slate-600'}`}>
              বিক্রয় ফেরত ও ভয়েড (Returns)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar Area */}
      <View style={{ padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
        <View className="flex-row items-center">
          <View className="flex-1">
            <Input
              placeholder="প্রোডাক্ট নাম, বারকোড বা SKU দিয়ে খুঁজুন..."
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              setScanFeedback(null);
              setScannerVisible(true);
            }}
            activeOpacity={0.85}
            className="h-12 w-12 ml-3 rounded-xl bg-[#7c3aed] items-center justify-center"
          >
            <Maximize color="#ffffff" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Product List */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {products.length === 0 ? (
          <Text className="text-center text-xs text-slate-400 mt-6 font-sans">কোনো প্রোডাক্ট পাওয়া যায়নি</Text>
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                onPress={() => addToCart(product)}
                activeOpacity={0.7}
                className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 w-[48%] shadow-sm"
              >
                <Text className="text-sm font-black text-slate-800 font-sans" numberOfLines={1}>{product.name}</Text>
                <Text className="text-[10px] text-slate-400 font-mono mt-1 mb-2" numberOfLines={1}>SKU-{product.sku || product.id.slice(0, 8)}</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-extrabold text-slate-800 font-sans">
                    ৳{(product.priceCents / 100).toFixed(0)}
                  </Text>
                  <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                    <Text className="text-[9px] font-black text-amber-700">{product.stock} pcs</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Summary Button */}
      {cartItemCount > 0 && !checkoutVisible && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setCheckoutVisible(true)}
          className="absolute bottom-4 left-4 right-4 bg-[#7c3aed] rounded-2xl flex-row items-center justify-between px-5 py-4 shadow-xl"
        >
          <View className="flex-row items-center">
            <View>
              <ShoppingCart color="#ffffff" size={24} />
              <View className="absolute -top-2 -right-2 bg-white h-4 min-w-[16px] rounded-full items-center justify-center px-1">
                <Text className="text-[#7c3aed] font-black text-[10px]">{cartItemCount}</Text>
              </View>
            </View>
            <Text className="text-white font-bold text-lg font-sans ml-3">কার্ট দেখুন</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-white font-black text-lg font-sans mr-2">৳{(finalTotalCents / 100).toFixed(0)}</Text>
            <ChevronUp color="#ffffff" size={20} />
          </View>
        </TouchableOpacity>
      )}

      {/* Checkout Mobile Bottom Sheet Modal */}
      <Modal visible={checkoutVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View className="bg-slate-50 h-[92%] rounded-t-2xl shadow-2xl overflow-hidden flex-col">
            
            {/* Sheet Header */}
            <View className="bg-white px-4 pb-3 pt-2.5 border-b border-slate-100 shrink-0">
              <View className="h-1 w-12 bg-slate-200 rounded-full mx-auto mb-3" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ShoppingCart color="#7c3aed" size={16} />
                  <Text className="text-sm font-bold text-slate-800 ml-2 font-sans">কার্ট ও চেকআউট</Text>
                </View>
                <TouchableOpacity onPress={() => setCheckoutVisible(false)} className="p-1">
                  <X color="#94a3b8" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="flex-1 p-4 pb-10">
              {/* Added Cart Items Preview */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-bold text-slate-800 font-sans flex-row items-center">
                  <ShoppingCart size={14} color="#7c3aed" className="mr-1" /> কার্ট ({cartItemCount})
                </Text>
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text className="text-red-600 text-xs font-bold font-sans">সব মুছুন</Text>
                </TouchableOpacity>
              </View>

              <View className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
                {cart.map((item) => (
                  <View key={item.product.id} className="border-b border-slate-100 py-3 last:border-b-0">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-sm font-bold text-slate-800 font-sans flex-1" numberOfLines={2}>
                        {item.product.name}
                      </Text>
                      <View className="flex-row items-center ml-2">
                        <Text className="text-sm font-black text-slate-800 font-sans mr-3">
                          ৳{((item.product.priceCents * item.quantity) / 100).toFixed(0)}
                        </Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.product.id, -item.quantity)}>
                          <Trash2 color="#ef4444" size={16} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View className="flex-row items-center mb-2">
                      <Text className="text-[10px] text-slate-500 font-sans mr-2">মূল্য: ৳</Text>
                      <View className="border border-slate-200 rounded px-1 w-16 h-7 justify-center">
                        <TextInput
                          className="text-xs font-bold text-slate-800 p-0 m-0"
                          keyboardType="numeric"
                          value={item.product.priceCents === 0 ? '' : (item.product.priceCents / 100).toString()}
                          onChangeText={(val) => {
                            if (val === '') {
                              setItemPrice(item.product.id, 0);
                              return;
                            }
                            const newPrice = parseFloat(val);
                            if (!isNaN(newPrice)) {
                              setItemPrice(item.product.id, newPrice * 100);
                            }
                          }}
                        />
                      </View>
                    </View>

                    <View className="flex-row items-center">
                      <View className="flex-row items-center justify-between w-28 bg-white border border-slate-200 rounded-lg p-0.5">
                        <TouchableOpacity onPress={() => updateQuantity(item.product.id, -1)} className="px-3 py-1.5 border-r border-slate-100 bg-slate-50 rounded-l-md">
                          <Text className="text-slate-600 font-bold">-</Text>
                        </TouchableOpacity>
                        <TextInput
                          className="font-bold text-slate-800 text-xs text-center flex-1 p-0 m-0 h-6"
                          keyboardType="numeric"
                          value={item.quantity === 0 ? '' : item.quantity.toString()}
                          onChangeText={(val) => {
                            if (val === '') {
                              setExactQuantity(item.product.id, 0);
                              return;
                            }
                            const newQty = parseInt(val, 10);
                            if (!isNaN(newQty)) {
                              setExactQuantity(item.product.id, newQty);
                            }
                          }}
                        />
                        <TouchableOpacity onPress={() => updateQuantity(item.product.id, 1)} className="px-3 py-1.5 border-l border-slate-100 bg-slate-50 rounded-r-md">
                          <Text className="text-slate-600 font-bold">+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text className="text-[10px] text-slate-400 font-sans ml-3">/ {item.product.stock} pcs</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View className="flex-row justify-between py-4 border-b border-slate-200 mb-4 px-2">
                <Text className="text-xs font-bold text-slate-600 font-sans">মোট আইটেম মূল্য (Subtotal):</Text>
                <Text className="text-sm font-black text-slate-800 font-sans">৳{(subtotalCents / 100).toFixed(0)}</Text>
              </View>

              <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-10">
                <Text className="text-sm font-black text-slate-800 font-sans">পেমেন্ট ও হিসাব বিবরণী</Text>
                <Text className="text-[10px] text-slate-400 font-semibold font-sans mb-4">Checkout Calculations & Payments</Text>

                <View className="space-y-3 mb-6">
                  <View className="flex-row justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Text className="text-xs font-bold text-slate-600 font-sans">আইটেম মূল্য (Subtotal):</Text>
                    <Text className="text-xs font-black text-slate-800 font-sans">৳{(subtotalCents / 100).toFixed(0)}</Text>
                  </View>
                  <View className="flex-row justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Text className="text-xs font-bold text-slate-600 font-sans">ছাড় / ডিসকাউন্ট (৳):</Text>
                    <TextInput
                      value={discountCents}
                      onChangeText={setDiscountCents}
                      keyboardType="numeric"
                      className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right text-xs font-bold text-slate-800"
                    />
                  </View>
                  <View className="flex-row justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <Text className="text-xs font-bold text-slate-600 font-sans">ভ্যাট / ট্যাক্স (৳):</Text>
                    <TextInput
                      value={taxCents}
                      onChangeText={setTaxCents}
                      keyboardType="numeric"
                      className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-right text-xs font-bold text-slate-800"
                    />
                  </View>
                  <View className="flex-row justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <Text className="text-sm font-black text-slate-800 font-sans">মোট প্রদেয় (Net Payable):</Text>
                    <Text className="text-sm font-black text-[#7c3aed] font-sans">৳{(finalTotalCents / 100).toFixed(0)}</Text>
                  </View>
                </View>

                {/* Customer Selection */}
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">কাস্টমার সিলেক্ট করুন</Text>
                <TouchableOpacity className="flex-row items-center bg-white border border-slate-200 rounded-lg p-3 mb-6">
                  <UserCircle color="#94a3b8" size={16} />
                  <Text className="text-xs text-slate-700 font-sans ml-2 flex-1">ওয়াক-ইন কাস্টমার (Walk-in Customer)</Text>
                  <ChevronUp color="#94a3b8" size={16} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>

                {/* Payment Methods exactly matching screenshot */}
                <Text className="text-xs font-bold text-slate-700 font-sans mb-2">পেমেন্ট মেথড</Text>
                <View className="flex-row flex-wrap justify-between mb-4">
                  {(['CASH', 'MFS'] as const).map(method => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => {
                        setPaymentStatus('PAID');
                        setPaymentMethod(method);
                      }}
                      className={`w-[48%] py-3 rounded-lg border items-center justify-center mb-2 ${paymentStatus === 'PAID' && paymentMethod === method ? 'bg-primary-50 border-primary' : 'bg-white border-slate-200'}`}
                    >
                      <Text className={`text-xs font-bold font-sans ${paymentStatus === 'PAID' && paymentMethod === method ? 'text-primary' : 'text-slate-600'}`}>
                        {method === 'CASH' ? 'নগদ ক্যাশ (Cash)' : 'মোবাইল ক্যাশ (MFS)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {(['DUE', 'PARTIAL'] as const).map(method => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPaymentStatus(method)}
                      className={`w-[48%] py-3 rounded-lg border items-center justify-center ${paymentStatus === method ? 'bg-primary-50 border-primary' : 'bg-white border-slate-200'}`}
                    >
                      <Text className={`text-xs font-bold font-sans ${paymentStatus === method ? 'text-primary' : 'text-slate-600'}`}>
                        {method === 'DUE' ? 'পুরো বাকি (Full Due)' : 'আংশিক বাকি (Partial)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Input 
                  label="নগদ জমা / ক্যাশ রিসিভড (৳)"
                  placeholder="234"
                  keyboardType="numeric"
                />
                
                <View className="flex-row justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg p-3 mt-3 mb-4">
                  <Text className="text-xs font-bold text-slate-700 font-sans">ফেরত পাবেন (Change Due):</Text>
                  <Text className="text-sm font-black text-emerald-700 font-sans">৳0</Text>
                </View>

                <TouchableOpacity
                  onPress={handleCheckout}
                  disabled={loading}
                  className="w-full bg-[#7c3aed] py-4 rounded-xl items-center justify-center"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-sm font-sans">বিক্রি সম্পন্ন করুন →</Text>
                  )}
                </TouchableOpacity>

              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => void resolveBarcode(code)}
        feedback={scanFeedback}
      />
    </View>
  );
}
export default PosScreen;
