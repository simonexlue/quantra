import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Keyboard, Platform } from 'react-native';
import {
  Portal, Dialog, Button, Text, TextInput,
  Menu, Divider, ActivityIndicator
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, doc, getDoc, updateDoc
} from '@react-native-firebase/firestore';
import { db } from '../services/firebase';
import { COL } from '../constants/collections';
import { fetchCatalog } from '../services/catalogService';
import { setItemLowThreshold } from '../services/inventoryService';
import type { CatalogItem } from '../types/catalog';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  itemId: string | null;     // e.g., 'avocado'
  locationId: string;        // current user's location
  canEditGlobal?: boolean;   // usually user.role === 'manager'
};

export default function ItemDetailModal({
  visible, onDismiss, itemId, locationId, canEditGlobal = true
}: Props) {

  const isReadOnly = !canEditGlobal;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Global item fields
  const [name, setName] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('each');

  // Per-location override
  const [lowThreshold, setLowThreshold] = useState<string>(''); // blank = no override
  const [note, setNote] = useState<string>('');                 // manager-only edit

  // Unit dropdown
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [allUnits, setAllUnits] = useState<string[]>([]);
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const customUnitRef = useRef<any>(null);

  const validThreshold = useMemo(() => {
    if (lowThreshold.trim() === '') return true;
    return /^\d+$/.test(lowThreshold.trim());
  }, [lowThreshold]);

  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, e => setKbHeight(e?.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  
  // safe area
  const insets = useSafeAreaInsets();
  const bottomBump = Platform.OS === 'ios' ? Math.max(0, kbHeight - insets.bottom) : kbHeight;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!visible || !itemId) return;
      setLoading(true);
      try {
        // --- Global item
        const itemRef = doc(collection(db, COL.items), itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists() && mounted) {
          const d = itemSnap.data() as any;
          setName(d.name ?? itemId);
          setDefaultUnit(d.defaultUnit ?? 'each');
        }

        // --- Per-location override (sparse)
        const locRef = doc(collection(db, COL.locations), locationId);
        const cfgRef = doc(collection(locRef, 'itemConfig'), itemId);
        const cfgSnap = await getDoc(cfgRef);
        if (mounted) {
          const cfg = cfgSnap.exists() ? (cfgSnap.data() as any) : undefined;
          const lt = typeof cfg?.lowThreshold === 'number' ? String(cfg.lowThreshold) : '';
          setLowThreshold(lt);
          setNote(typeof cfg?.note === 'string' ? cfg.note : '');
        }

        // Units from catalog
        const catalog = (await fetchCatalog()) as CatalogItem[];
        const unitValues: string[] = (catalog ?? []).map(
          (c) => String(c.defaultUnit ?? 'each')
        );
        const units: string[] = Array.from(new Set<string>(unitValues)).sort();
        if (mounted) {
          setAllUnits(units);
          // If the current unit isn't in the list, reveal custom input
          setShowCustomUnit(units.indexOf(String(defaultUnit)) === -1);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [visible, itemId, locationId]);

  useEffect(() => {
    // When we toggle custom, focus the field
    if (showCustomUnit) {
      setTimeout(() => customUnitRef.current?.focus?.(), 0);
    }
  }, [showCustomUnit]);

  const onSave = async () => {
    if (!itemId) return;
    setSaving(true);
    try {
      // update global default unit (manager only)
      if (canEditGlobal) {
        const itemRef = doc(collection(db, COL.items), itemId);
        await updateDoc(itemRef, { defaultUnit });
      }

      // set / clear location low threshold
      const trimmed = lowThreshold.trim();
      await setItemLowThreshold(
        locationId,
        itemId,
        trimmed === '' ? null : Number(trimmed)
      );

      // save/update note at the per-location itemConfig (manager only)
      if (canEditGlobal) {
        const locRef = doc(collection(db, COL.locations), locationId);
        const cfgRef = doc(collection(locRef, 'itemConfig'), itemId);
        await updateDoc(cfgRef, { note }); // creates the doc if rules allow set; if not existing, consider setDoc
      }

      onDismiss();
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, bottomBump ? { marginBottom: bottomBump } : null]}
      >
        <Dialog.Content>
          {loading ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 0 }}
            >
              <Text variant="headlineSmall" style={{ marginBottom: 16, textAlign: 'left' }}>
                {name}
              </Text>

              {isReadOnly ? (
                <>
                  <Text style={{ marginTop: 4, marginBottom: 6, opacity: 0.7 }}>Default unit</Text>
                  <View style={styles.roChip}>
                    <Text>{defaultUnit}</Text>
                  </View>

                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Low threshold</Text>
                  <View style={styles.roBox}>
                    <Text style={lowThreshold.trim() === '' ? styles.roPlaceholder : undefined}>
                      {lowThreshold.trim() !== '' ? lowThreshold : 'default'}
                    </Text>
                  </View>

                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Notes</Text>
                  <View style={[styles.roBox, { minHeight: 72 }]}>
                    <Text style={note ? undefined : styles.roPlaceholder}>
                      {note || 'No notes'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Default unit */}
                  <Text style={{ marginTop: 4, marginBottom: 6, opacity: 0.7 }}>Default unit</Text>
                  <Menu
                    visible={unitMenuVisible}
                    onDismiss={() => setUnitMenuVisible(false)}
                    anchor={
                      <TouchableOpacity activeOpacity={0.7} onPress={() => setUnitMenuVisible(true)}>
                        <View style={styles.anchorBtn}>
                          <Text>{defaultUnit}</Text>
                        </View>
                      </TouchableOpacity>
                    }
                    anchorPosition="top"
                    contentStyle={{
                      maxHeight: 360,
                      borderRadius: 12,
                      overflow: 'hidden',
                      paddingVertical: 0,
                    }}
                  >
                    <ScrollView
                      style={{ maxHeight: 360 }}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={{ paddingVertical: 8 }}
                    >
                      {allUnits.map((u) => (
                        <Menu.Item
                          key={u}
                          title={u}
                          onPress={() => {
                            setDefaultUnit(u);
                            setShowCustomUnit(false);
                            setUnitMenuVisible(false);
                          }}
                        />
                      ))}
                      <Divider />
                      <Menu.Item
                        title="Type a custom unit…"
                        onPress={() => {
                          setShowCustomUnit(true);
                          setUnitMenuVisible(false);
                        }}
                      />
                    </ScrollView>
                  </Menu>

                  {showCustomUnit && (
                    <TextInput
                      ref={customUnitRef}
                      mode="outlined"
                      label="Custom unit"
                      placeholder="e.g., case, lb, bag"
                      value={defaultUnit}
                      onChangeText={setDefaultUnit}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      right={<TextInput.Icon icon="check" onPress={() => Keyboard.dismiss()} />}
                      style={{ marginTop: 8 }}
                    />
                  )}

                  {/* Low threshold */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Low threshold</Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="number-pad"
                    placeholder="default"
                    value={lowThreshold}
                    onChangeText={setLowThreshold}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    right={<TextInput.Icon icon="check" onPress={() => Keyboard.dismiss()} />}
                  />
                  {!validThreshold && (
                    <Text style={{ color: 'red', marginTop: 4 }}>Enter a whole number.</Text>
                  )}

                  {/* Notes */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Notes</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="e.g., Avocados count by singles on weekdays"
                    value={note}
                    onChangeText={setNote}
                    multiline
                    numberOfLines={4}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    right={<TextInput.Icon icon="check" onPress={() => Keyboard.dismiss()} 
                    style={{marginBottom: 0, paddingBottom:0}}/>}
                  />
                </>
              )}
            </ScrollView>
          )}
        </Dialog.Content>

        <Dialog.Actions>
          {isReadOnly && <Button onPress={onDismiss}>Close</Button>}

          {!isReadOnly && (
            <Button onPress={onDismiss} disabled={saving}>
              Cancel
            </Button>
          )}

          {!isReadOnly && (
            <Button
              onPress={() => {
                Keyboard.dismiss();
                onSave();
              }}
              loading={saving}
              disabled={!validThreshold || loading}
            >
              Save
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    marginVertical: 20,
  },
  roChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  roChipText: { 
    fontSize: 14,
    fontWeight: 400,
  },
  roBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  roValue: { fontSize: 16 },
  roPlaceholder: { fontSize: 16, opacity: 0.5 },
  anchorBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
    backgroundColor: 'white',
  },
  anchorBtnText: { 
    fontWeight: '400',
  },
});
