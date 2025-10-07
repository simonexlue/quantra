import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { createDrawerNavigator, DrawerContentScrollView } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TouchableRipple, Text, List, Divider } from "react-native-paper";

import { useAuth } from "../../auth/useAuth";
import LoginScreen from "../../screens/LoginScreen";
import InventoryListScreen from "../../screens/InventoryListScreen";
import InventoryInputScreen from "../../screens/InventoryInputScreen";
import ManagerRouteBuilderScreen from "../../screens/ManagerRouteBuilderScreen";

import type { Supplier } from "../../types/catalog";
import { fetchSuppliers } from "../../services/suppliersService";

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const INDENT = 16;        // top-level
const CHILD_INDENT = 32;  // children of Inventory

const ON_SURFACE = "#1C1C1E";
const ACTIVE_PURPLE = "#6750A4";

function Row({
  label,
  onPress,
  indent = INDENT,
  active = false,
  right,
}: {
  label: string;
  onPress?: () => void;
  indent?: number;
  active?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableRipple onPress={onPress} rippleColor="rgba(0,0,0,0.06)">
      <View style={[styles.rowBase, { paddingLeft: indent }]}>
        <Text style={[styles.rowText, { color: active ? ACTIVE_PURPLE : ON_SURFACE }]}>{label}</Text>
        <View style={{ marginLeft: "auto" }}>{right}</View>
      </View>
    </TouchableRipple>
  );
}

function CustomDrawerContent(props: any) {
  const { user, signOut } = useAuth();
  const isManager = user?.role === "manager";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetchSuppliers()
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  const activeRoute = props.state.routes[props.state.index];
  const activeSupplier =
    activeRoute?.name === "InventoryList" ? activeRoute?.params?.supplierId : undefined;

  const isAllItems   = activeRoute?.name === "InventoryList" && !activeSupplier;
  const isNewCount   = activeRoute?.name === "Input";
  // track if Route Builder is active
  const isRouteBuilder = activeRoute?.name === "RouteBuilder";

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* top-level peer of Inventory */}
      <Row
        label="New Count"
        active={isNewCount}
        onPress={() => {
          props.navigation.navigate("Input");
          props.navigation.closeDrawer();
        }}
      />

      {/* Manager-only Route Builder entry */}
      {isManager && (
        <Row
          label="Route Builder"
          active={isRouteBuilder}
          onPress={() => {
            props.navigation.navigate("RouteBuilder");
            props.navigation.closeDrawer();
          }}
        />
      )}

      <Divider style={{ marginVertical: 12 }} />

      {/* Inventory header (top-level) */}
      <Row label="Inventory" />

      {/* SIBLINGS under Inventory */}
      <Row
        label="All Items"
        indent={CHILD_INDENT}
        active={isAllItems}
        onPress={() => {
          props.navigation.navigate("InventoryList");
          props.navigation.closeDrawer();
        }}
      />

      {/* Suppliers — custom collapsible */}
      <Row
        label="Suppliers"
        indent={CHILD_INDENT}
        active={!!activeSupplier}
        onPress={() => setOpen((v) => !v)}
        right={<List.Icon icon={open ? "chevron-up" : "chevron-down"} />}
      />
      {open &&
        suppliers.map((s) => {
          const active = activeSupplier === s.id;
          return (
            <Row
              key={s.id}
              label={s.name ?? s.id}
              indent={CHILD_INDENT + 16}
              active={active}
              onPress={() => {
                props.navigation.navigate("InventoryList", { supplierId: s.id });
                props.navigation.closeDrawer();
              }}
            />
          );
        })}

      <View style={{ marginTop: "auto" }}>
        <Divider />
        <TouchableRipple onPress={signOut}>
          <View style={[styles.rowBase, { paddingLeft: INDENT }]}>
            <List.Icon icon="logout" />
            <Text style={[styles.rowText, { marginLeft: 8 }]}>Log Out</Text>
          </View>
        </TouchableRipple>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  rowBase: {
    minHeight: 44,
    paddingVertical: 10,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  rowText: { fontSize: 16, fontWeight: "400" },
});

function AppDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="InventoryList"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerTitleAlign: "center" }}
    >
      {/* hidden auto items */}
      <Drawer.Screen
        name="InventoryList"
        component={InventoryListScreen}
        options={{ title: "Inventory", drawerItemStyle: { height: 0 } }}
      />
      <Drawer.Screen
        name="Input"
        component={InventoryInputScreen}
        options={{ title: "New Count", drawerItemStyle: { height: 0 } }}
      />

      <Drawer.Screen
        name="RouteBuilder"
        component={ManagerRouteBuilderScreen}
        options={{ title: "Route Builder", drawerItemStyle: { height: 0 } }}
      />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="App" component={AppDrawer} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
