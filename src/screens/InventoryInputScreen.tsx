import React, { useEffect, useState, useMemo} from "react";
import { View, FlatList, StyleSheet} from 'react-native';
import { ActivityIndicator, Text, TextInput, Button, Card} from 'react-native-paper';
import { useAuth } from "../auth/useAuth";
import { fetchCatalog } from "../services/catalogService";
import { saveSubmissionAndUpdateCounts } from "../services/inventoryService";
import { useInventory } from "../hooks/useInventory";
import SpeechModal from "../components/SpeechBar";
import { parseSpeechToLines } from "../services/speechParser";
import type { CatalogItem } from "../types/catalog";
import MicButton from "../components/MicButton";
import ConfirmChipsSheet from "../components/ConfirmChipsSheet";


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
    
    // Speech modal
    const [speechModalVisible, setSpeechModalVisible] = useState(false);
    
    // Track which inputs have been changed from their original values
    const [changedInputs, setChangedInputs] = useState<Set<string>>(new Set());

    // Confirm chips sheet
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [pendingParsed, setPendingParsed] = useState<{ itemId: string; qty: number }[]>([]);
    
    // Track speech analysis for highlighting unrecognized text
    const [speechAnalysis, setSpeechAnalysis] = useState<{
      rawText: string;
      unrecognizedParts: string[];
      parsedItems: string[];
    } | null>(null);

    // Maps itemId -> current qty
    const currentQtyByItem = useMemo(() => {
        const m: Record<string, number> = {};
        for (const r of currentRows) m[r.itemId] = r.qty;
        return m;
    }, [currentRows]);

    // Load catalog once
    useEffect(() => {
        fetchCatalog()
            .then((arr: CatalogItem[]) => {
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
          setDrafts(d => {
            const copy = { ...d };
            for (const { itemId } of linesToSave) {
              copy[itemId] = '';
            }
            return copy;
          });
          setChangedInputs(new Set()); // Clear highlighting after successful save
          setSpeechAnalysis(null); // Clear speech analysis after successful save
        } finally {
          setSaving(false);
        }
      }

      function handleSpeechConfirm(text: string) {
        if (!text.trim()) return;
        const parsed = parseSpeechToLines(text, items);
      
        const analysis = analyzeSpeechText(text, parsed, items);
        setSpeechAnalysis(analysis);
      
        if (!parsed.length) return;
      
        // Don't write into drafts yet — let the user review first
        setPendingParsed(parsed);
        setConfirmVisible(true);
      }

      function applyApprovedLines(approved: { itemId: string; qty: number }[]) {
        // track changed inputs
        const changedItemIds = new Set(changedInputs);
        for (const line of approved) changedItemIds.add(line.itemId);
        setChangedInputs(changedItemIds);
      
        // merge into drafts
        setDrafts(d => {
          const copy = { ...d };
          for (const line of approved) {
            copy[line.itemId] = String(line.qty);
          }
          return copy;
        });
      }

      function analyzeSpeechText(rawText: string, parsed: any[], catalog: CatalogItem[]) {
        const lowerText = rawText.toLowerCase();
        const recognizedParts: string[] = [];
        
        // Collect all recognized item names and quantities
        for (const line of parsed) {
          const item = catalog.find(i => i.id === line.itemId);
          if (item) {
            recognizedParts.push(`${line.qty} ${item.name}`);
            // Also check for synonyms
            if (item.synonyms) {
              item.synonyms.forEach(synonym => {
                if (lowerText.includes(synonym.toLowerCase())) {
                  recognizedParts.push(synonym);
                }
              });
            }
          }
        }
        
        // Find unrecognized phrases (group consecutive unrecognized words)
        const unrecognizedParts: string[] = [];
        const words = lowerText.split(/\s+/);
        
        let currentPhrase: string[] = [];
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          
          // Check if this word is recognized
          const isRecognized = recognizedParts.some(part => 
            part.toLowerCase().includes(word)
          );
          
          // Skip common filter words
          const isFilterWord = ['and', 'the', 'a', 'an', 'to', 'of', 'in', 'for', 'with', 'on'].includes(word);
          
          if (!isRecognized && !isFilterWord) {
            // Add to current unrecognized phrase
            currentPhrase.push(word);
          } else {
            // Word is recognized, finish current phrase if any
            if (currentPhrase.length > 0) {
              unrecognizedParts.push(currentPhrase.join(' '));
              currentPhrase = [];
            }
          }
        }
        
        // Don't forget the last phrase if it ends with unrecognized words
        if (currentPhrase.length > 0) {
          unrecognizedParts.push(currentPhrase.join(' '));
        }
        
        return {
          rawText,
          unrecognizedParts,
          parsedItems: parsed.map(p => {
            const item = catalog.find(i => i.id === p.itemId);
            return item ? `${p.qty} ${item.name}` : `${p.qty} ${p.itemId}`;
          })
        };
      }

      function handleInputChange(itemId: string, value: string) {
        // Track that this input has been changed
        const originalValue = currentQtyByItem[itemId] != null ? String(currentQtyByItem[itemId]) : '';
        const hasChanged = value !== originalValue;
        
        setChangedInputs(prev => {
            const newSet = new Set(prev);
            if (hasChanged) {
                newSet.add(itemId);
            } else {
                newSet.delete(itemId);
            }
            return newSet;
        });
        
        // Update the draft
        setDrafts(d => ({ ...d, [itemId]: value }));
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
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text variant="titleLarge" style={{ marginBottom: 6 }}>Inventory Entry</Text>
            </View>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving || linesToSave.length === 0}
              compact={true}
              style={styles.saveButton}
              contentStyle={styles.saveButtonContent}
            >
              Save
            </Button>
          </View>
          <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 0 }} />
          
          {speechAnalysis && speechAnalysis.unrecognizedParts.length > 0 && (
            <View style={styles.speechAnalysis}>
              <Text style={styles.speechAnalysisTitle}>Unrecognized Text</Text>
              <View style={styles.speechTextContainer}>
                <Text style={styles.speechText}>
                  {speechAnalysis.unrecognizedParts.join(', ')}
                </Text>
              </View>
              <Text style={styles.speechAnalysisNote}>
                This text wasn't recognized. You may want to check these items manually.
              </Text>
            </View>
          )}
    
          <FlatList
            data={items}
            keyExtractor={it => it.id}
            style={{ flex: 1, width: '100%', alignSelf: 'stretch' }}
            contentContainerStyle={styles.listContainer}
            scrollIndicatorInsets={{ right: -24 }}
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
                        onChangeText={(t) => {
                          const cleanValue = t.replace(/[^\d.]/g, '');
                          handleInputChange(item.id, cleanValue);
                        }}
                        style={[
                          styles.input,
                          changedInputs.has(item.id) && styles.changedInput
                        ]}
                        contentStyle={[
                          styles.inputContent,
                          changedInputs.has(item.id) && styles.changedContent
                        ]}
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

          <ConfirmChipsSheet
            visible={confirmVisible}
            onDismiss={() => setConfirmVisible(false)}
            parsed={pendingParsed}
            catalog={items}
            onApply={applyApprovedLines}
          />
          
          <MicButton
            onPress={() => setSpeechModalVisible(true)}
            label="Speak"
          />
          
          <SpeechModal
            visible={speechModalVisible}
            onDismiss={() => setSpeechModalVisible(false)}
            onConfirm={handleSpeechConfirm}
          />
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
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      },
      titleSection: {
        flex: 1,
        marginRight: 16,
      },
      saveButton: {
        alignSelf: 'flex-start',
        borderRadius: 15,
      },
      saveButtonContent: {
        paddingHorizontal: 8,
        paddingVertical: 0,
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
      fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
      },
      changedInput: {
        backgroundColor: '#e3f2fd',
      },
      changedContent: {
        backgroundColor: '#e3f2fd',
      },
      speechAnalysis: {
        backgroundColor: '#fff3cd',
        borderColor: '#ffeaa7',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginHorizontal: 24,
        marginBottom: 8,
      },
      speechAnalysisTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 8,
      },
      speechTextContainer: {
        backgroundColor: '#fff',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
      },
      speechText: {
        fontSize: 13,
        lineHeight: 18,
        color: '#333',
      },
      speechAnalysisNote: {
        fontSize: 11,
        color: '#856404',
        fontStyle: 'italic',
      },
    });