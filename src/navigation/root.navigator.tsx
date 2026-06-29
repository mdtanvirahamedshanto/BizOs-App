import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
} from '@react-navigation/drawer';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import { useAuthStore, useHasPermission } from '@/store/auth.store';
import { logoutAndRevoke } from '@/features/auth/logout';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { PosScreen } from '@/features/pos/screens/PosScreen';
import { CashbookScreen } from '@/features/cashbook/screens/CashbookScreen';
import { KhataScreen } from '@/features/khata/screens/KhataScreen';
import { PurchasesScreen } from '@/features/purchases/screens/PurchasesScreen';
import { ExpensesScreen } from '@/features/expenses/screens/ExpensesScreen';
import { ReportsScreen } from '@/features/reports/screens/ReportsScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { InventoryScreen } from '@/features/inventory/screens/InventoryScreen';
import { MobileServicesScreen } from '@/features/mfs/screens/MobileServicesScreen';
import { t } from '@/utils/translation';
import { Shield, LogOut, LayoutDashboard, ShoppingCart, BookOpen, Warehouse, Menu as MenuIcon, ShoppingBag, Truck, Receipt, Wallet, Smartphone, Send, Users, BarChart3, Settings as SettingsIcon } from 'lucide-react-native';

function CustomDrawerContent(props: any) {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigation<any>();
  const canReadReports = useHasPermission('reports.read');
  const canReadProducts = useHasPermission('products.read');

  const handleLogout = () => {
    Alert.alert(
      t('save') === 'সেভ করুন' ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
      t('save') === 'সেভ করুন' ? 'আপনি কি লগআউট করতে চান?' : 'Are you sure you want to log out?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('save') === 'সেভ করুন' ? 'হ্যাঁ, লগআউট করুন' : 'Yes, Log Out',
          style: 'destructive',
          onPress: () => void logoutAndRevoke(),
        },
      ]
    );
  };

  const menuItems = [
    { name: 'Dashboard', label: t('save') === 'সেভ করুন' ? 'ড্যাশবোর্ড' : 'Dashboard', icon: LayoutDashboard },
    { name: 'POS', label: t('save') === 'সেভ করুন' ? 'বিক্রয় (POS)' : 'POS', icon: ShoppingBag },
    ...(canReadProducts ? [{ name: 'Inventory', label: t('save') === 'সেভ করুন' ? 'ইনভেন্টরি' : 'Inventory', icon: Warehouse }] : []),
    { name: 'Purchases', label: t('save') === 'সেভ করুন' ? 'ক্রয় ব্যবস্থাপনা' : 'Purchases', icon: Truck },
    { name: 'Khata', label: t('save') === 'সেভ করুন' ? 'লেনদেন হিসেব' : 'Khata', icon: BookOpen },
    { name: 'Expenses', label: t('save') === 'সেভ করুন' ? 'খরচ ব্যবস্থাপনা' : 'Expenses', icon: Receipt },
    { name: 'Cashbook', label: t('save') === 'সেভ করুন' ? 'ক্যাশবুক হিসাব' : 'Cashbook', icon: Wallet },
    { name: 'MobileServices', label: t('save') === 'সেভ করুন' ? 'মোবাইল সার্ভিস' : 'Mobile Services', icon: Smartphone },
    { name: 'TelegramBot', label: t('save') === 'সেভ করুন' ? 'টেলিগ্রাম বট' : 'Telegram Bot', icon: Send },
    { name: 'Customers', label: t('save') === 'সেভ করুন' ? 'গ্রাহক তালিকা' : 'Customers', icon: Users },
    ...(canReadReports ? [{ name: 'Reports', label: t('save') === 'সেভ করুন' ? 'রিপোর্ট সমূহ' : 'Reports', icon: BarChart3 }] : []),
    { name: 'Settings', label: t('save') === 'সেভ করুন' ? 'সেটিংস' : 'Settings', icon: SettingsIcon },
  ];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1, paddingBottom: 16 }}>
      {/* A. User Identity Profile Badge Header */}
      <View className="p-4 bg-slate-50 border-b border-slate-100 mb-2 rounded-xl mx-4 mt-2">
        <View className="flex-row items-center">
          <View className="h-10 w-10 rounded-full bg-primary items-center justify-center mr-3">
            <Text className="text-white font-bold text-lg font-sans">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View>
            <Text className="text-sm font-black text-slate-800 font-sans">{user?.name || 'User'}</Text>
            <View className="flex-row items-center mt-0.5">
              <Shield size={10} color="#7c3aed" />
              <Text className="text-[10px] font-bold text-primary ml-1 font-sans">
                {user?.role === 'OWNER' ? (t('save') === 'সেভ করুন' ? 'মালিক (Owner)' : 'Owner') : user?.role}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* B. Navigation Router Links */}
      <View className="flex-1 px-2">
        {menuItems.map((item) => (
          <DrawerItem
            key={item.name}
            label={item.label}
            icon={({ color, size }) => <item.icon color={color} size={size} />}
            onPress={() => nav.navigate(item.name)}
            activeTintColor="#4f46e5"
            inactiveTintColor="#475569"
            activeBackgroundColor="#eef2ff"
            labelStyle={{ fontSize: 12, fontWeight: '700', marginLeft: -16 }}
            style={{ borderRadius: 8, marginBottom: 4 }}
          />
        ))}
      </View>

      {/* C. Interactive Logout Trigger Footer */}
      <View className="px-4 mt-auto">
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          className="h-12 w-full bg-rose-50 rounded-xl flex-row items-center justify-center"
        >
          <LogOut size={16} color="#e11d48" className="mr-2" />
          <Text className="text-rose-600 text-sm font-bold font-sans">
            {t('save') === 'সেভ করুন' ? 'লগ আউট (Log Out)' : 'Log Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

// ---------------------------------------------------------
// Navigation Types & Configuration
// ---------------------------------------------------------
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppDrawerParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  POS: undefined;
  Inventory: undefined;
  Purchases: undefined;
  Khata: undefined;
  Expenses: undefined;
  Cashbook: undefined;
  MobileServices: undefined;
  TelegramBot: undefined;
  Customers: undefined;
  Reports: undefined;
  Settings: undefined;
  MenuTab: undefined;
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

const DummyScreen = () => <View className="flex-1 bg-white items-center justify-center"><Text className="text-slate-500 font-sans font-bold">Coming Soon...</Text></View>;

function MainTabsNavigator({ navigation }: any) {
  return (
    <AppTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 6,
          paddingTop: 6,
          height: 54,
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <AppTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ 
          tabBarLabel: t('save') === 'সেভ করুন' ? 'হোম' : 'Home',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />
        }}
      />
      <AppTab.Screen
        name="POS"
        component={PosScreen}
        options={{ 
          tabBarLabel: t('save') === 'সেভ করুন' ? 'বিক্রয়' : 'Sales',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
        }}
      />
      <AppTab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ 
          tabBarLabel: t('save') === 'সেভ করুন' ? 'স্টক' : 'Stock',
          tabBarIcon: ({ color, size }) => <Warehouse color={color} size={size} />
        }}
      />
      <AppTab.Screen
        name="Cashbook"
        component={CashbookScreen}
        options={{ 
          tabBarLabel: t('save') === 'সেভ করুন' ? 'হিসাব' : 'Accounts',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />
        }}
      />
      <AppTab.Screen
        name="MenuTab"
        component={View}
        options={{ 
          tabBarLabel: t('save') === 'সেভ করুন' ? 'মেনু' : 'Menu',
          tabBarIcon: ({ color, size }) => <MenuIcon color={color} size={size} />
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.openDrawer();
          },
        }}
      />

      {/* Hidden Screens (No Tab Bar Icon, but keeps Tab Bar visible) */}
      <AppTab.Screen name="Purchases" component={PurchasesScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="Khata" component={KhataScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="Expenses" component={ExpensesScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="MobileServices" component={MobileServicesScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="TelegramBot" component={DummyScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="Customers" component={DummyScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="Reports" component={ReportsScreen} options={{ tabBarButton: () => null }} />
      <AppTab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
    </AppTab.Navigator>
  );
}

function AppDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabsNavigator} />
    </Drawer.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="App" component={AppDrawerNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

// ---------------------------------------------------------
// Deep Linking Map Configurations
// ---------------------------------------------------------
import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['bizos://', 'https://bizos.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
        },
      },
      App: {
        screens: {
          MainTabs: {
            screens: {
              Dashboard: 'dashboard',
              POS: 'pos',
              Cashbook: 'cashbook',
              Inventory: 'inventory',
              Khata: 'khata',
              Purchases: 'purchases',
              Expenses: 'expenses',
              Reports: 'reports',
              Settings: 'settings',
            },
          },
        },
      },
    },
  },
};

