import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import RootNavigator from "./src/app/navigation/RootNavigator";
import { AppProviders } from "./src/app/AppProviders";
import { AuthProvider } from "./src/auth/useAuth";

import { PaperProvider } from "react-native-paper";
import { paperTheme } from "./src/theme/paperTheme";

export default function App() {
  try {
    return (
      <PaperProvider theme={paperTheme}>
        <StatusBar style="light" backgroundColor={paperTheme.colors.background} />

        <AppProviders>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </AppProviders>
      </PaperProvider>
    );
  } catch (error) {
    console.error("App Error:", error);
    return (
      <View style={[styles.container, { backgroundColor: "#121212" }]}>
        <Text style={[styles.text, { color: "#FFFFFF" }]}>App Error - Check Console</Text>
        <StatusBar style="light" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
  },
});
