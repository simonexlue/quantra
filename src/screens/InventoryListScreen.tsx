import React, { useState, useEffect, useMemo } from "react";
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
import { useRoute } from "@react-navigation/native";
import { fetchCatalog } from "../services/catalogService";
import type { CatalogItem } from "../types/catalog";

type RouteParams = { supplierId?: string };

export default function InventoryListScreen() {
  const route = useRoute<any>();
  const supplierFilter: string | undefined = (route.params as RouteParams)?.supplierId;

  const { user } = useAuth();
  const { rows, loading } = useInventory(user?.locationId);

  const [lastUpdateUserName, setLastUpdateUserName] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, { lowThreshold: number }>>({});

  const [catalogMap, setCatalogMap] = useState<Record<string, CatalogItem>>({});
  const [catalogLoading, setCatalogLoading] = useState<boolean>(!!supplierFilter);

  // Modal state MUST be before early returns
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // ---- Effects ----
  useEffect(() => {
    if (!user?.locationId) return;
    const unsub = subscribeLocationOverrides(user.locationId, setOverrides);
    return unsub;
  }, [user?.locationId]);

  useEffect(() => {
    let active = true;
    if (!supplierFilter) {
      setCatalogLoading(false);
      return;
    }
    (async () => {
      try {
        setCatalogLoading(true);
        const items = await fetchCatalog();
        if (!active) return;
        const map = Object.fromEntries(items.map((i: CatalogItem) => [i.id, i]));
        setCatalogMap(map);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supplierFilter]);

  useEffect(() => {
    const fetchLastUpdateUserName = async () => {
      if (rows.length === 0) return;
      const mostRecent = rows.reduce((latest, current) => {
        const latestTime = latest.updatedAt?.toDate?.() || new Date(latest.updatedAt || 0);
        const currentTime = current.updatedAt?.toDate?.() || new Date(current.updatedAt || 0);
        return currentTime > latestTime ? current : latest;
      });
      try {
        const userRef = doc(collection(db, "users"), mostRecent.updatedBy);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setLastUpdateUserName(userData.name || userData.email || mostRecent.updatedBy);
        } else {
          setLastUpdateUserName(mostRecent.updatedBy);
        }
      } catch {
        setLastUpdateUserName(mostRecent.updatedBy);
      }
    };
    fetchLastUpdateUserName();
  }, [rows]);

  // ---- Memos ----
  const lastUpdate = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((latest, current) => {
      const latestTime = latest.updatedAt?.seconds || 0;
      const currentTime = current.updatedAt?.seconds || 0;
      return currentTime > latestTime ? current : latest;
    });
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (!supplierFilter) return rows;
    if (catalogLoading) return [];
  
    const want = String(supplierFilter).toLowerCase();
  
    return rows.filter((line) => {
      const item = catalogMap[line.itemId];
      if (!item) return false;
  
      // Gather possible supplier fields
      const sources = [
        (item as any).suppliers,          // string[]
        (item as any).supplierId,         // string OR string[]
        (item as any).primarySupplierId,  // string
      ];
  
      // Normalize to a flat string[]
      const list: string[] = sources
        .flatMap((src) => {
          if (!src) return [];
          if (Array.isArray(src)) return src;
          return [src]; // string
        })
        .map((s) => String(s).toLowerCase());
  
      if (!list.length) return false;
      return list.includes(want);
    });
  }, [rows, catalogMap, supplierFilter, catalogLoading]);
  

  // ---- Early returns AFTER all hooks ----
  if (!user) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Sign in required.</Text>
      </View>
    );
  }

  if (loading || (supplierFilter && catalogLoading)) {
    return (
      <View style={{ padding: 24 }}>
        <ActivityIndicator />
      </View>
    );
  }

  // ---- Helpers ----
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleString();
  };

  // ---- Render ----
  return (
    <>
      <View style={styles.header}>
        {supplierFilter ? <Text style={styles.filterTag}>Filter: {supplierFilter}</Text> : null}
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Last updated: {formatDate(lastUpdate.updatedAt)} by {lastUpdateUserName || lastUpdate.updatedBy}
          </Text>
        )}
      </View>

      <FlatList
        data={displayedRows}
        keyExtractor={(it) => `${it.locationId}_${it.itemId}`}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => {
              setSelectedItemId(item.itemId);
              setModalOpen(true);
            }}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.row}>
                <Text variant="titleMedium" style={[styles.colName, styles.left]} numberOfLines={1}>
                  {item.itemName}
                </Text>
                <Text style={[styles.colQty, styles.left]}>
                  {item.qty} {item.defaultUnit ?? "each"}
                </Text>
                <View style={styles.colFlag}>
                  <FlagPill
                    flag={computeFlag(item.qty, {
                      low: overrides[item.itemId]?.lowThreshold,
                    })}
                  />
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
        canEditGlobal={user?.role === "manager"}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 8,
    gap: 6,
  },
  filterTag: {
    fontSize: 12,
    opacity: 0.8,
    color: "#333",
  },
  lastUpdate: {
    fontSize: 12,
    opacity: 0.6,
    color: "#666",
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    backgroundColor: "#fff",
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { textAlign: "left" },
  colName: { flex: 1, fontWeight: "500", paddingRight: 8 },
  colQty: { width: 120 },
  colFlag: { width: 56, alignItems: "flex-start" },
  separator: { height: 8 },
});
