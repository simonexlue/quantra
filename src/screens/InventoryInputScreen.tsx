import React, { useEffect, useState, useMemo} from "react";
import { View, FlatList, StyleSheet} from 'react-native';
import { ActivityIndicator, Text, TextInput, Button, Card} from 'react-native-paper';
import { useAuth } from "../auth/useAuth";
import { fetchCatalog } from "../services/catalogService";
import { saveSubmissionAndUpdateCounts } from "../services/inventoryService";
import { useInventory } from "../hooks/useInventory";
import SpeechBar from "../components/SpeechBar";
import { parseSpeechToLines } from "../services/speechParser";
import type { CatalogItem } from "../types/catalog";


export default function InventoryInputScreen() {
    const { user} = useAuth();

    // Catalog items
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(true);

    // Current inventory (live, per location)
    const { rows: currentRows, loading: loadingInventory} = useInventory(user?.locationId);

    // Text inputs (no blanks)
    const [saving, setSaving] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({}); // itemId -> qty text

    // Maps itemId -> current qty
    const currentQtyByItem = useMemo(() => {
        const m: Record<string, number> = {};
        for (const r of currentRows) m[r.itemId] = r.qty;
        return m;
    }, [currentRows]);

    // Load catalog once
    useEffect(() => {
        fetchCatalog()
            .then((arr: any[]) => {
                const sorted = [...arr].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
                setItems(sorted);
                setDrafts(Object.fromEntries(sorted.map((it) => [it.id, '']))); // Blank template for each item
            })
            .finally(() => setLoadingCatalog(false));
    }, []);

    // Only save lines the user actually typed, and only if numeric
    const linesToSave = useMemo(() => {
        const out: { itemId: string; qty: number }[] = [];
        for (const it of items) {
            const txt = (drafts[it.id] ?? '').trim();
            if (txt === '') continue; // untouched -> do not write -> leave previous value in Firestore
            const num = Number(txt);
            if (!Number.isFinite(num)) continue; // guard against '.', '', etc.
            const prev = currentQtyByItem[it.id];
            if (prev !== undefined && prev === num) continue; // no change
            out.push({ itemId: it.id, qty: num });
        }
        return out;
    }, [items, drafts, currentQtyByItem]);


    async function handleSave() {
        if (!user || linesToSave.length === 0) return;
        setSaving(true);
        try {
          await saveSubmissionAndUpdateCounts({
            locationId: user.locationId,
            updatedBy: user.uid,
            lines: linesToSave,
          });
          // After a successful save, clear only the rows you edited so the placeholders (current counts) show again
          setDrafts(d =>
            Object.fromEntries(Object.keys(d).map(k => [k, '']))
          );
        } finally {
          setSaving(false);
        }
      }

      function handleSpeechConfirm(text: string) {
        if(!text.trim()) return;
        const parsed = parseSpeechToLines(text, items);
        if(!parsed.length) return; 

        // Merge results into drafts so the TextInputs fill in automatically
        setDrafts(d => {
            const copy = { ...d};
            for (const line of parsed) {
                copy[line.itemId] = String(line.qty);
            }
            return copy;
        })
      }

      const loading = loadingCatalog || loadingInventory;

      if (!user) {
        return <View style={styles.pad}><Text>Sign in required.</Text></View>;
      }
      if (loading) {
        return <View style={styles.pad}><ActivityIndicator /></View>;
      }


      return (
        <View style={styles.container}>
          <SpeechBar onConfirm={handleSpeechConfirm} />
          <View style={{height:16}}/>
          <Text variant="titleLarge" style={{ marginBottom: 6 }}>Manual Inventory Entry</Text>
          <Text style={{ opacity: 0.7, marginBottom: 10 }}>
            Edit only what changed. Unedited rows keep their last recorded amount.
          </Text>
          <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 16 }} />
    
          <FlatList
            data={items}
            keyExtractor={it => it.id}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const placeholder =
                currentQtyByItem[item.id] != null ? String(currentQtyByItem[item.id]) : '—';
              return (
                <Card style={styles.card}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.row}>
                      <Text style={styles.label}>{item.name ?? item.id}</Text>
                      <TextInput
                        mode="outlined"
                        keyboardType="numeric"
                        placeholder={placeholder}
                        value={drafts[item.id] ?? ''}
                        onChangeText={(t) =>
                          setDrafts(d => ({ ...d, [item.id]: t.replace(/[^\d.]/g, '') }))
                        }
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        outlineStyle={styles.inputOutline}
                        dense
                      />
                      <Text style={styles.unit}>{item.defaultUnit ?? 'each'}</Text>
                    </View>
                  </Card.Content>
                </Card>
              );
            }}
          />
    
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || linesToSave.length === 0}
          >
            Save
          </Button>
        </View>
      );
    }
    
    const styles = StyleSheet.create({
      container: { 
        flex: 1, 
        padding: 24 
    },
      pad: { 
        padding: 24 
    },
      listContainer: {
        paddingVertical: 8,
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
        gap: 12
    },
      label: { 
        flex: 1, 
        fontSize: 16 
    },
      input: { 
        width: 120 
    },
      inputContent: {
        borderRadius: 16,
      },
      inputOutline: {
        borderRadius: 16,
      },
      unit: { 
        width: 48, opacity: 0.6 
    },
      separator: {
        height: 8,
      },
    });