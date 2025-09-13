import React from "react";
import { Provider as PaperProvider } from "react-native-paper";

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <PaperProvider>{children}</PaperProvider>
);