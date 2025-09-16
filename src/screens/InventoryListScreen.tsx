import React from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
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
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <View style={styles.itemInfo}>
                <Text variant="titleMedium" style={styles.itemName}>
                  {item.itemName}
                </Text>
              </View>
              <View style={styles.rightSection}>
                <View style={styles.quantityContainer}>
                  <Text>Qty: {item.qty}</Text>
                </View>
                <View style={styles.flagContainer}>
                  <FlagPill flag={item.flag} />
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}
      contentContainerStyle={styles.listContainer}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  card: {
    marginHorizontal: 4,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    backgroundColor: '#fff',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityContainer: {
    width: 80,
  },
  flagContainer: {
    width: 50,
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
});
