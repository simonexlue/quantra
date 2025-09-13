import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/useAuth";
import LoginScreen from "../../screens/LoginScreen";
import InventoryListScreen from "../../screens/InventoryListScreen";
import InventoryInputScreen from "../../screens/InventoryInputScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    const { user, loading } = useAuth();

    if (loading) return null; 
    return (
        <NavigationContainer>
            <Stack.Navigator>
                {
                    !user ? (
                        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    ) : (
                        <>
                            <Stack.Screen name="Inventory" component={InventoryListScreen} />
                            <Stack.Screen name="Input" component={InventoryInputScreen} />
                        </>
                    )
                }
            </Stack.Navigator>
        </NavigationContainer>
    );
}