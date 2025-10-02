import React, { useState, useEffect } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { useAuth } from "../auth/useAuth";
import { useInventory } from "../hooks/useInventory";
import FlagPill from "../components/FlagPill";
import { doc, getDoc, collection } from "@react-native-firebase/firestore";
import { db } from "../services/firebase";
import ItemDetailModal from "../components/ItemDetailModal";
import { subscribeLocationOverrides } from "../services/inventoryService";
import { computeFlag } from "../constants/flags";

export default function InventoryListScreen() {
  const { user } = useAuth();
  const { rows, loading } = useInventory(user?.locationId); // reads currentInventory which has updatedBy and updatedAt
  const [lastUpdateUserName, setLastUpdateUserName] = useState<string>('');

  // Item detail modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string|null>(null);
  const [overrides, setOverrides] = useState<Record<string, { lowThreshold: number }>>({});

  //location overrides
  useEffect(() => {
    if (!user?.locationId) return;
    const unsub = subscribeLocationOverrides(user.locationId, setOverrides);
    return unsub;
  }, [user?.locationId]);
  
  // Fetch user name for the most recent update only
  useEffect(() => {
    const fetchLastUpdateUserName = async () => {
      if (rows.length === 0) return;
      
      // Find the most recent update
      const mostRecent = rows.reduce((latest, current) => {
        const latestTime = latest.updatedAt?.toDate?.() || new Date(latest.updatedAt || 0);
        const currentTime = current.updatedAt?.toDate?.() || new Date(current.updatedAt || 0);
        return currentTime > latestTime ? current : latest;
      });
      
      // Only fetch the name for this one user
      try {
        const userRef = doc(collection(db, 'users'), mostRecent.updatedBy);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setLastUpdateUserName(userData.name || userData.email || mostRecent.updatedBy);
        } else {
          setLastUpdateUserName(mostRecent.updatedBy);
        }
      } catch (error) {
        setLastUpdateUserName(mostRecent.updatedBy);
      }
    };

    fetchLastUpdateUserName();
  }, [rows]);

  if (!user) return <View style={{ padding: 24 }}><Text>Sign in required.</Text></View>;
  if (loading) return <View style={{ padding: 24 }}><ActivityIndicator /></View>;

  // Find the most recent update
  const getLastUpdateInfo = () => {
    if (rows.length === 0) return null;
    
    return rows.reduce((latest, current) => {
      // Compare raw timestamp values first 
      const latestTime = latest.updatedAt?.seconds || 0;
      const currentTime = current.updatedAt?.seconds || 0;
      
      if (currentTime > latestTime) {
        return current;
      }
      return latest;
    });
  };

  const lastUpdate = getLastUpdateInfo();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      {lastUpdate && (
        <View style={styles.header}>
          <Text style={styles.lastUpdate}>
            Last updated: {formatDate(lastUpdate.updatedAt)} by {lastUpdateUserName || lastUpdate.updatedBy}
          </Text>
        </View>
      )}
      <FlatList
        data={rows} // [{ itemId, qty, flag, locationId, ... }]
        keyExtractor={(it) => `${it.locationId}_${it.itemId}`}
        renderItem={({ item }) => (
        <Card 
          style={styles.card}
          onPress={() => {
            setSelectedItemId(item.itemId);
            setModalOpen(true);
          }}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <Text variant="titleMedium" style={[styles.colName, styles.left]} numberOfLines={1}>
                {item.itemName}
              </Text>
              <Text style={[styles.colQty, styles.left]}>{item.qty} {item.defaultUnit ?? 'each'}</Text>
              <View style={styles.colFlag}>
                <FlagPill flag={computeFlag(item.qty, { low: overrides[item.itemId]?.lowThreshold })} />
              </View>
            </View>
          </Card.Content>
        </Card>
      )}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
      />
      <ItemDetailModal
        visible={modalOpen}
        onDismiss={() => setModalOpen(false)}
        itemId={selectedItemId}
        locationId={user!.locationId}
        canEditGlobal={user?.role === 'manager'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24, 
    paddingVertical: 16,
    paddingBottom: 8,
  },
  lastUpdate: {
    fontSize: 12,
    opacity: 0.6,
    color: '#666',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
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
  left: {
    textAlign: 'left',
  },
  colName: {
    flex: 1,
    fontWeight: '500',
    paddingRight: 8,
  },
  colQty: {
    width: 120, // widened to include unit inline
  },
  colFlag: {
    width: 56,
    alignItems: 'flex-start',
  },
  separator: {
    height: 8,
  },
});
