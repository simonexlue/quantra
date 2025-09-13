import React from "react";
import { View } from "react-native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList} from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../../auth/useAuth";
import LoginScreen from "../../screens/LoginScreen";
import InventoryListScreen from "../../screens/InventoryListScreen";
import InventoryInputScreen from "../../screens/InventoryInputScreen";

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function CustomDrawerContent(props: any) {
    const { signOut } = useAuth();
    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1}}>
            <DrawerItemList {...props} />

            <View style={{ marginTop: "auto"}}>
                <DrawerItem label="Log Out" onPress={signOut} />
            </View>
        </DrawerContentScrollView>
    )
}

/** Drawer shown after login */
function AppDrawer() {
    return (
        <Drawer.Navigator
            initialRouteName="InventoryList"
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{ headerTitleAlign: "center"}}
            >
                <Drawer.Screen 
                    name="InventoryList"
                    component={InventoryListScreen}
                    options={{ title: "Inventory"}}
                />
                <Drawer.Screen 
                    name="Input"
                    component={InventoryInputScreen}
                    options={{ title: "New Count"}}
                />
            </Drawer.Navigator>
    )
}

export default function RootNavigator() {
    const { user, loading } = useAuth();

    if (loading) return null; 
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false}}>
                {
                    !user ? (
                        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                    ) : (
                        <>
                            <Stack.Screen name="App" component={AppDrawer} />
                        </>
                    )
                }
            </Stack.Navigator>
        </NavigationContainer>
    );
}