import React, { useEffect, useState, useMemo} from "react";
import { View, FlatList, StyleSheet} from 'react-native';
import { ActivityIndicator, Text, TextInput, Button, Divider} from 'react-native-paper';
import { useAuth } from "../auth/useAuth";
import { fetchCatalog } from "../services/catalogService";
import { saveSubmissionAndUpdateCounts } from "../services/inventoryService";

type CatalogItem = { id: string; name?: string; defaultUnit?: string};

export default function InventoryInputScreen() {
    const { user} = useAuth();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({}); // itemId -> qty text

    // Load catalog once
    useEffect(() => {
        fetchCatalog()
            .then((arr: any[]) => {
                const sorted = [...arr].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
                setItems(sorted);
                setDrafts(Object.fromEntries(sorted.map((it) => [it.id, '']))); // Blank template for each item
            })
            .finally(() => setLoading(false));
    }, []);

    // Convert text inputs to numeric lines, ignore blanks
    const linesToSave = useMemo(
        () => 
            Object.entries(drafts)
                .map(([itemId, txt]) => ({itemId, qty: Number(txt)}))
                .filter((l) => Number.isFinite(l.qty)),
            [drafts]);

    async function handleSave() {
        if(!user || linesToSave.length === 0) return;
        setSaving(true);

        try {
            console.log('[debug] preflight save', {
                uid: user.uid,
                userLocationId: user.locationId,
                numLines: linesToSave.length,
            });
            await saveSubmissionAndUpdateCounts({
                locationId: user.locationId,
                updatedBy: user.uid,
                lines: linesToSave,
            });
            // Clear inputs after successful save
            setDrafts((d) => Object.fromEntries(Object.keys(d).map((k) => [k, ''])));
        } catch (error) {
            console.error('[debug] save failed', error);
        } finally {
            setSaving(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text variant="titleMedium" style={{marginBottom: 6}}>Manual Inventory Input</Text>
            <Text style={{ opacity: 0.7, marginBottom: 10}}>Type counts for the items you checked</Text>
            <Divider />

            <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                ItemSeparatorComponent={Divider}
                renderItem={({item}) => (
                    <View style={styles.row}>
                        <Text style={styles.label}>{item.name ?? item.id}</Text>
                        <TextInput 
                            mode="outlined"
                            keyboardType="numeric"
                            placeholder="-"
                            value={drafts[item.id] ?? ''}
                            onChangeText={(t) =>
                                setDrafts((d) => ({...d, [item.id]: t.replace(/[^\d.]/g, '')}))
                            }
                            style={styles.input}
                            dense
                        />
                        <Text style={styles.unit}>{item.defaultUnit ?? 'each'}</Text>
                    </View>
                )}
            >
            </FlatList>

            <Button
                mode="contained"
                onPress={() => handleSave()}
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
        padding: 24,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
    },

    label: {
        flex: 1,
        fontSize: 16,
    },

    input: {
        width: 120,
    },

    unit: {
        width: 48,
        opacity: 0.6,
    }
});