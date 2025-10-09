import React, { useEffect, useMemo, useRef, useState, useImperativeHandle } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  Platform,
} from "react-native";
import {
  Portal,
  Dialog,
  Button,
  Text,
  TextInput,
  Menu,
  Divider,
  ActivityIndicator,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, doc, getDoc, updateDoc, setDoc } from "@react-native-firebase/firestore";
import { db } from "../services/firebase";
import { COL } from "../constants/collections";
import { fetchCatalog } from "../services/catalogService";
import { setItemLowThreshold } from "../services/inventoryService";
import type { CatalogItem } from "../types/catalog";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  itemId: string | null;     // e.g., 'avocado'
  locationId: string;        // current user's location
  canEditGlobal?: boolean;   // usually user.role === 'manager'
};

export default function ItemDetailModal({
  visible,
  onDismiss,
  itemId,
  locationId,
  canEditGlobal = true,
}: Props) {
  const theme = useTheme();

  const isReadOnly = !canEditGlobal;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Global item fields
  const [name, setName] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("each");

  // Per-location override
  const [lowThreshold, setLowThreshold] = useState<string>(""); // blank = no override
  const [note, setNote] = useState<string>("");                 // parent copy for initial value

  // Unit dropdown
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [allUnits, setAllUnits] = useState<string[]>([]);
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const customUnitRef = useRef<any>(null);

  const validThreshold = useMemo(() => {
    if (lowThreshold.trim() === "") return true;
    return /^\d+$/.test(lowThreshold.trim());
  }, [lowThreshold]);

  // keyboard bump
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, (e) => setKbHeight(e?.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);
  const insets = useSafeAreaInsets();
  const bottomBump = Platform.OS === "ios" ? Math.max(0, kbHeight - insets.bottom) : kbHeight;

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
          setDefaultUnit(d.defaultUnit ?? "each");
        }

        // --- Per-location override (sparse)
        const locRef = doc(collection(db, COL.locations), locationId);
        const cfgRef = doc(collection(locRef, "itemConfig"), itemId);
        const cfgSnap = await getDoc(cfgRef);
        if (mounted) {
          const cfg = cfgSnap.exists() ? (cfgSnap.data() as any) : undefined;
          const lt = typeof cfg?.lowThreshold === "number" ? String(cfg.lowThreshold) : "";
          setLowThreshold(lt);
          setNote(typeof cfg?.note === "string" ? cfg.note : "");
        }

        // Units from catalog
        const catalog = (await fetchCatalog()) as CatalogItem[];
        const unitValues: string[] = (catalog ?? []).map((c) => String(c.defaultUnit ?? "each"));
        const units: string[] = Array.from(new Set<string>(unitValues)).sort();
        if (mounted) {
          setAllUnits(units);
          setShowCustomUnit(units.indexOf(String(defaultUnit)) === -1);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [visible, itemId, locationId]);

  useEffect(() => {
    if (showCustomUnit) {
      setTimeout(() => customUnitRef.current?.focus?.(), 0);
    }
  }, [showCustomUnit]);

  // --- Notes ref to read latest value at save time
  type NotesFieldHandle = { getValue: () => string };
  const notesRef = useRef<NotesFieldHandle>(null);

  const onSave = async () => {
    if (!itemId) return;
    setSaving(true);
    try {
      // always grab the latest text from the child
      const latestNote = notesRef.current?.getValue() ?? note;

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
        trimmed === "" ? null : Number(trimmed)
      );

      // save/update note at the per-location itemConfig (manager only)
      if (canEditGlobal) {
        const locRef = doc(collection(db, COL.locations), locationId);
        const cfgRef = doc(collection(locRef, "itemConfig"), itemId);
        // use setDoc(..., {merge:true}) so it also works if doc doesn't exist yet
        await setDoc(cfgRef, { note: latestNote }, { merge: true });
      }

      onDismiss();
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
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 0 }}
            >
              <Text
                variant="headlineSmall"
                style={{
                  marginBottom: 16,
                  textAlign: "left",
                  color: theme.colors.primary,
                  fontWeight: "600",
                }}
              >
                {name}
              </Text>

              {isReadOnly ? (
                <>
                  {/* Default unit */}
                  <Text style={{ marginTop: 4, marginBottom: 6, opacity: 0.7 }}>Default unit</Text>
                  <View style={styles.roChip}>
                    <Text style={styles.roChipText}>{defaultUnit}</Text>
                  </View>

                  {/* Low threshold */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Low threshold</Text>
                  <View style={styles.roBox}>
                    <Text
                      style={[
                        styles.roValue,
                        lowThreshold.trim() === "" && styles.roPlaceholder,
                      ]}
                    >
                      {lowThreshold.trim() !== "" ? lowThreshold : "default"}
                    </Text>
                  </View>

                  {/* Notes */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 0.7 }}>Notes</Text>
                  <View style={[styles.roBox, { minHeight: 72 }]}>
                    <Text style={[styles.roValue, !note && styles.roPlaceholder]}>
                      {note || "No notes"}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Default unit */}
                  <Text style={{ marginTop: 4, marginBottom: 6, opacity: 1, fontWeight: "500" }}>
                    Default unit
                  </Text>
                  <Menu
                    visible={unitMenuVisible}
                    onDismiss={() => setUnitMenuVisible(false)}
                    anchor={
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setUnitMenuVisible(true)}
                      >
                        <View
                          style={[
                            styles.anchorBtn,
                            { borderColor: theme.colors.primary, borderWidth: 0.75 },
                          ]}
                        >
                          <Text style={[styles.anchorBtnText, { color: theme.colors.primary, fontWeight: "500" }]}>{defaultUnit}</Text>
                        </View>
                      </TouchableOpacity>
                    }
                    anchorPosition="top"
                    contentStyle={{
                      maxHeight: 360,
                      borderRadius: 12,
                      overflow: "hidden",
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
                          titleStyle={u === defaultUnit ? { color: theme.colors.primary, fontWeight: "600" } : undefined}
                          trailingIcon={u === defaultUnit ? "check" : undefined}  // shows a check on the active one
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
                      outlineColor={theme.colors.primary}
                      activeOutlineColor={theme.colors.primary}
                      theme={{ roundness: 22 }}
                      outlineStyle={{ borderWidth: 0.75 }}
                    />
                  )}

                  {/* Low threshold */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 1, fontWeight: "500" }}>
                    Low threshold
                  </Text>
                  <TextInput
                    mode="outlined"
                    keyboardType="number-pad"
                    placeholder="default"
                    value={lowThreshold}
                    onChangeText={setLowThreshold}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    right={<TextInput.Icon icon="check" onPress={() => Keyboard.dismiss()} />}
                    outlineColor={theme.colors.primary}
                    activeOutlineColor={theme.colors.primary}
                    theme={{ roundness: 22 }}
                    outlineStyle={{ borderWidth: 0.75 }}
                  />
                  {!validThreshold && (
                    <Text style={{ color: "red", marginTop: 4 }}>Enter a whole number.</Text>
                  )}

                  {/* Notes */}
                  <Text style={{ marginTop: 16, marginBottom: 6, opacity: 1, fontWeight: "500" }}>
                    Notes
                  </Text>
                  <NotesField
                    ref={notesRef}
                    visible={visible}
                    initialValue={note}
                    outlineColor={theme.colors.primary}
                    onCommit={setNote}
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
              buttonColor={theme.colors.primary}
              textColor="#fff"
              style={{ paddingHorizontal: 10, marginLeft: 10 }}
            >
              Save
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}


// Keeps keystrokes local so the Dialog doesn't re-render.
// Parent grabs the latest value at save-time via ref.getValue().

type NotesFieldHandle = { getValue: () => string };
const NotesField = React.memo(
  React.forwardRef<NotesFieldHandle, {
    visible: boolean;
    initialValue: string;
    outlineColor: string;
    onCommit: (val: string) => void;
  }>(function NotesField({ visible, initialValue, outlineColor, onCommit }, ref) {
    const [local, setLocal] = React.useState(initialValue);

    // Reset local when modal opens or initialValue changes
    React.useEffect(() => {
      if (visible) setLocal(initialValue);
    }, [visible, initialValue]);

    // Expose current value to parent (so Save always has the latest)
    React.useImperativeHandle(ref, () => ({ getValue: () => local }), [local]);

    return (
      <TextInput
        mode="outlined"
        value={local}
        onChangeText={setLocal}
        multiline
        returnKeyType="default"
        outlineColor={outlineColor}
        activeOutlineColor={outlineColor}
        theme={{ roundness: 22 }}
        outlineStyle={{ borderWidth: 0.75 }}
        contentStyle={{ textAlignVertical: "top" }}
        right={
          <TextInput.Icon
            icon="check"
            onPress={() => {
              onCommit(local);      // commit to parent immediately
              Keyboard.dismiss(); 
            }}
          />
        }
      />
    );
  })
);

const styles = StyleSheet.create({
  dialog: { marginVertical: 20 },

  // Read-only “chip” (Default unit)
  roChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF2F6",
    borderWidth: 1,
    borderColor: "#D0D5DD",
  },
  roChipText: {
    fontSize: 14,
    color: "#344054",
    fontWeight: "500",
  },

  // Read-only field boxes (Low threshold, Notes)
  roBox: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F2F4F7",
  },
  roValue: { fontSize: 16, color: "#344054" },
  roPlaceholder: { fontSize: 16, color: "#98A2B3" },

  // Editable unit button
  anchorBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.6)",
    backgroundColor: "white",
  },
  anchorBtnText: { fontWeight: "400" },
});
