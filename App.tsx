import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import React, { useEffect } from 'react';
import { getApp } from '@react-native-firebase/app';
import RootNavigator from './src/app/navigation/RootNavigator';
import { AppProviders } from './src/app/AppProviders';
import { AuthProvider } from './src/auth/useAuth';

export default function App() {
  useEffect(() => {
    try {
      const options = getApp().options as any;
      console.log('[debug] firebase options', {
        projectId: options?.projectId,
        appId: options?.appId,
        apiKey: options?.apiKey ? '***' : undefined,
      });
    } catch {}
  }, []);
  try {
    return (
      <AppProviders>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </AppProviders>
    );
  } catch (error) {
    console.error('App Error:', error);
    return (
      <View style={styles.container}>
        <Text style={styles.text}>App Error - Check Console</Text>
        <StatusBar style="auto" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});
