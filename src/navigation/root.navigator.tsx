import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';

function DashboardScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-slate-50">
      <Text className="text-lg font-bold text-primary font-sans">Dashboard Panel</Text>
      <Text className="text-xs text-slate-500 font-sans mt-1">SME Overview and Key Metrics</Text>
    </View>
  );
}

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

// 1. Navigation Parameter Type Definitions
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  POS: undefined;
  Cashbook: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab = createBottomTabNavigator<AppTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppTab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <AppTab.Screen name="Dashboard" component={DashboardScreen} />
      <AppTab.Screen name="POS" component={PosScreen} />
      <AppTab.Screen name="Cashbook" component={CashbookScreen} />
    </AppTab.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="App" component={AppNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}
