import React, { useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { Portal, Dialog, Button, TextInput, List, Checkbox, Divider } from "react-native-paper";
import type { CatalogItem } from "../types/catalog";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  items: CatalogItem[];             // global catalog
  initialSelected?: string[];       // ids that are ALREADY in the section
  onConfirm: (ids: string[]) => void;
};

// Safely turn synonyms into a string[]
function getSynonymsArray(synonyms: unknown): string[] {
  if (Array.isArray(synonyms)) return synonyms.filter(Boolean) as string[];
  if (typeof synonyms === "string") return synonyms.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  return [];
}

export default function MultiSelectModal({
  visible,
  onDismiss,
  items,
  initialSelected = [],
  onConfirm,
}: Props) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  // When modal opens or initialSelected changes, reset selection
  useEffect(() => {
    if (visible) setSel(new Set<string>()); // new picks (don’t preselect existing)
  }, [visible, initialSelected]);

  const existing = useMemo(() => new Set(initialSelected), [initialSelected]);

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

  function toggle(id: string, isExisting: boolean) {
    if (isExisting) return; // don’t toggle items already in the section
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Only add new selections (exclude existing)
  const toAdd = useMemo(
    () => Array.from(sel).filter((id) => !existing.has(id)),
    [sel, existing]
  );

  const addLabelCount = toAdd.length;
  const addCta =
    addLabelCount > 0 ? `Add ${addLabelCount} item${addLabelCount === 1 ? "" : "s"}` : "Done";

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: "88%" }}>
        <Dialog.Title>Add items</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            placeholder="Search items..."
            value={q}
            onChangeText={setQ}
          />
          <Divider style={{ marginVertical: 8 }} />
          <FlatList
            style={{ maxHeight: 360 }}
            data={filtered}
            keyExtractor={(it) => it.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item: it }) => {
              const isExisting = existing.has(it.id);
              const isSelected = sel.has(it.id) || isExisting;
              const checkboxStatus = isSelected ? "checked" : "unchecked";

              return (
                <List.Item
                  title={it.name ?? it.id}
                  description={
                    isExisting
                      ? "Already in this section"
                      : (it.defaultUnit ?? undefined)
                  }
                  onPress={() => toggle(it.id, isExisting)}
                  left={() => (
                    <Checkbox
                      status={checkboxStatus as any}
                      disabled={isExisting}
                    />
                  )}
                />
              );
            }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={() => {
              onConfirm(toAdd); // only send new ids
            }}
            disabled={toAdd.length === 0}
          >
            {addCta}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
