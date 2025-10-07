import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  FlatList,
} from "react-native";
import {
  Portal,
  Surface,
  Text,
  TextInput,
  Divider,
  List,
  Checkbox,
  Button,
  useTheme,
} from "react-native-paper";
import type { CatalogItem } from "../types/catalog";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  items: CatalogItem[];
  initialSelected?: string[];
  onConfirm: (ids: string[]) => void;
};

// Safely turn synonyms into a string[]
function getSynonymsArray(synonyms: unknown): string[] {
  if (Array.isArray(synonyms)) return synonyms.filter(Boolean) as string[];
  if (typeof synonyms === "string")
    return synonyms.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function MultiSelectModal({
  visible,
  onDismiss,
  items,
  initialSelected = [],
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const SURFACE = colors.surface;

  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  // reset selection when opened 
  useEffect(() => {
    if (visible) setSel(new Set<string>()); 
  }, [visible, initialSelected]);

  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);

  const existing = useMemo(() => new Set(initialSelected), [initialSelected]);

  // filter logic 
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => {
      const nameHit = (i.name ?? i.id).toLowerCase().includes(s);
      if (nameHit) return true;
      const syns = getSynonymsArray((i as any).synonyms).map((x) => x.toLowerCase());
      return syns.some((syn) => syn.includes(s));
    });
  }, [q, items]); 

  // selection logic 
  function toggle(id: string, isExisting: boolean) {
    if (isExisting) return;
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  } 

  const toAdd = useMemo(
    () => Array.from(sel).filter((id) => !existing.has(id)),
    [sel, existing]
  );
  const addCtaCount = toAdd.length;
  const addCta =
    addCtaCount > 0 ? `Add ${addCtaCount} item${addCtaCount === 1 ? "" : "s"}` : "Done";

  if (!visible) return null;

  return (
    <Portal>
      {/* Fullscreen dimmed backdrop */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        {/* Tap outside to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        {/* Card-like surface */}
        <Surface style={[styles.card, { backgroundColor: SURFACE }]}>
          {/* Title */}
          <Text variant="titleLarge" style={styles.title}>
            Add items
          </Text>

          {/* Body */}
          <View style={styles.body}>
            <TextInput
              mode="outlined"
              placeholder="Search items..."
              value={q}
              onChangeText={setQ}
              right={
                <TextInput.Icon
                  icon={q ? "close-circle" : "close-circle-outline"}
                  onPress={() => setQ("")}
                  forceTextInputFocus={false}
                  // keep tap target comfy but subtle
                  style={{ marginTop: 4 }}
                  // accessibility
                  accessibilityLabel="Clear search"
                />
              }
            />

            <Divider style={{ marginVertical: 8 }} />

            {/* Cap list height so footer stays visible */}
            <View style={{ maxHeight: 360 }}>
              <FlatList
                data={filtered}
                keyExtractor={(it) => it.id}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                showsVerticalScrollIndicator={false}
                style={{ flexGrow: 0, backgroundColor: SURFACE }}
                renderItem={({ item: it }) => {
                  const isExisting = existing.has(it.id);
                  const isSelected = sel.has(it.id) || isExisting;
                  const checkboxStatus = isSelected ? "checked" : "unchecked";
                  return (
                    <List.Item
                      title={it.name ?? it.id}
                      description={
                        isExisting ? "Already in this section" : (it.defaultUnit ?? undefined)
                      }
                      onPress={() => toggle(it.id, isExisting)}
                      style={{ backgroundColor: SURFACE }}
                      left={() => (
                        <Checkbox status={checkboxStatus as any} disabled={isExisting} />
                      )}
                    />
                  );
                }}
              />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Button onPress={onDismiss} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button mode="contained" onPress={() => onConfirm(toAdd)} disabled={toAdd.length === 0}>
              {addCta}
            </Button>
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    borderRadius: 16,
    elevation: 4,
    overflow: "hidden", // clip any inner edges cleanly
  },
  title: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
