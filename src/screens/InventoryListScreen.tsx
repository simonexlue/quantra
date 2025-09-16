import React from "react";
import { FlatList, View } from "react-native";
import { ActivityIndicator, Divider, List, Text } from "react-native-paper";
import { useAuth } from "../auth/useAuth";
import { useInventory } from "../hooks/useInventory";
import FlagPill from "../components/FlagPill";

export default function InventoryListScreen() {
  const { user } = useAuth();
  const { rows, loading } = useInventory(user?.locationId); // reads currentInventory

  if (!user) return <View style={{ padding: 24 }}><Text>Sign in required.</Text></View>;
  if (loading) return <View style={{ padding: 24 }}><ActivityIndicator /></View>;

  return (
    <FlatList
      data={rows} // [{ itemId, qty, flag, locationId, ... }]
      keyExtractor={(it) => `${it.locationId}_${it.itemId}`}
      ItemSeparatorComponent={Divider}
      renderItem={({ item }) => (
        <List.Item
          title={item.itemId}
          right={() => (
            <View style={{ paddingRight: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 80 }}>
                <Text>Qty: {item.qty}</Text>
              </View>
              <View style={{ width: 50, marginLeft: 8 }}>
                <FlagPill flag={item.flag} />
              </View>
            </View>
          )}
        />
      )}
      contentContainerStyle={{ padding: 8 }}
    />
  );
}
