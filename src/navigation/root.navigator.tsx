import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { NavigatorScreenParams } from '@react-navigation/native';
import { useAuthStore, useHasPermission } from '@/store/auth.store';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { t } from '@/utils/translation';

// ---------------------------------------------------------
// Screen Placeholders
// ---------------------------------------------------------

function PosScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <Text className="text-lg font-bold text-slate-800 font-sans">Terminal POS</Text>
      <Text className="text-xs text-slate-500 font-sans mt-1">Scan barcodes or add items to cart</Text>
    </View>
  );
}

function CashbookScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <Text className="text-lg font-bold text-slate-800 font-sans">Cashbook & Drawers</Text>
      <Text className="text-xs text-slate-500 font-sans mt-1">Cash In, Out, and Daily Close</Text>
    </View>
  );
}

function ReportsScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <Text className="text-lg font-bold text-slate-800 font-sans">SME Reports Screen</Text>
      <Text className="text-xs text-slate-550 font-sans mt-1">Protected: Only visible to Managers & Admins</Text>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <Text className="text-lg font-bold text-slate-800 font-sans">Terminal Settings Screen</Text>
      <Text className="text-xs text-slate-550 font-sans mt-1">Protected: Only visible to Admins & SuperAdmins</Text>
    </View>
  );
}

// ---------------------------------------------------------
// Custom Side Drawer Drawer Layout
// ---------------------------------------------------------
function CustomDrawerContent(props: any) {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      t('save') === 'সেভ করুন' ? 'লগআউট নিশ্চিতকরণ' : 'Confirm Logout',
      t('save') === 'সেভ করুন' ? 'আপনি কি লগআউট করতে চান?' : 'Are you sure you want to log out?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('save') === 'সেভ করুন' ? 'হ্যাঁ, লগআউট করুন' : 'Yes, Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* A. User Identity Profile Badge Header */}
      <View className="p-5 border-b border-slate-100 bg-slate-50/50 mb-2">
        <Text className="text-lg font-black text-slate-800 font-sans">BizOS Mobile</Text>
        {user && (
          <View className="mt-3">
            <Text className="text-xs font-bold text-slate-700 font-sans">{user.name}</Text>
            <Text className="text-[10px] text-slate-400 font-semibold font-sans mt-0.5">{user.email}</Text>
            <View className="bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 mt-2 self-start">
              <Text className="text-[8px] font-black text-primary uppercase font-sans">{user.role}</Text>
            </View>
          </View>
        )}
      </View>

      {/* B. Navigation Router Links */}
      <View className="flex-1">
        <DrawerItemList {...props} />
      </View>

      {/* C. Interactive Logout Trigger Footer */}
      <View className="p-4 border-t border-slate-150 mb-2">
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          className="h-10 w-full bg-rose-50 border border-rose-100 rounded-lg flex-row items-center justify-center"
        >
          <Text className="text-rose-600 text-xs font-extrabold font-sans">
            {t('save') === 'সেভ করুন' ? 'লগআউট করুন' : 'Log Out'}
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
  Cashbook: undefined;
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<AppTabParamList>;
  Reports: undefined;
  Settings: undefined;
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

function MainTabsNavigator() {
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
        options={{ tabBarLabel: t('save') === 'সেভ করুন' ? 'ড্যাশবোর্ড' : 'Dashboard' }}
      />
      <AppTab.Screen
        name="POS"
        component={PosScreen}
        options={{ tabBarLabel: t('save') === 'সেভ করুন' ? 'পিওএস' : 'POS' }}
      />
      <AppTab.Screen
        name="Cashbook"
        component={CashbookScreen}
        options={{ tabBarLabel: t('save') === 'সেভ করুন' ? 'ক্যাশবোর্ড' : 'Cashbook' }}
      />
    </AppTab.Navigator>
  );
}

function AppDrawerNavigator() {
  const canReadReports = useHasPermission('reports:read');
  const canWriteSettings = useHasPermission('settings:write');

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        },
        headerTitleStyle: {
          fontSize: 14,
          fontWeight: '800',
          color: '#1e293b',
        },
        drawerActiveTintColor: '#4f46e5',
        drawerInactiveTintColor: '#64748b',
        drawerLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ drawerLabel: t('save') === 'সেভ করুন' ? 'হোম পেজ' : 'Home' }}
      />
      
      {/* Protected routes filtered dynamically via user permissions array */}
      {canReadReports && (
        <Drawer.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ drawerLabel: t('save') === 'সেভ করুন' ? 'রিপোর্ট সমূহ' : 'Reports' }}
        />
      )}

      {canWriteSettings && (
        <Drawer.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ drawerLabel: t('save') === 'সেভ করুন' ? 'সেটিংস' : 'Settings' }}
        />
      )}
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
            },
          },
          Reports: 'reports',
          Settings: 'settings',
        },
      },
    },
  },
};
