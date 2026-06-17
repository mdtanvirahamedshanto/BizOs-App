import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from './src/lib/api/client';
import { DATABASE_NAME, initializeDatabase } from './src/lib/db/sqlite';
import { RootNavigator, linking } from './src/navigation/root.navigator';
import { initNetworkListener } from './src/lib/network/network.store';
import { useAutoSync } from './src/features/sync/sync-engine';
import { GlobalStatusBanner } from './src/components/ui/GlobalStatusBanner';
import './global.css';

/**
 * Inner shell mounted inside the SQLite + Navigation providers so it can run
 * the offline sync engine and observe connectivity.
 */
function AppShell() {
  useAutoSync();

  return (
    <View style={{ flex: 1 }}>
      <GlobalStatusBanner />
      <NavigationContainer linking={linking}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    const unsubscribe = initNetworkListener();
    return unsubscribe;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
            <AppShell />
          </SQLiteProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
