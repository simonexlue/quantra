import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import RootNavigator from './src/app/navigation/RootNavigator';
import { AppProviders } from './src/app/AppProviders';
import { AuthProvider } from './src/auth/useAuth';

export default function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppProviders>
  );
}

const styles = StyleSheet.create({

});
