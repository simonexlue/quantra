import React, { useEffect, useState, useMemo } from "react";
import { View, FlatList, StyleSheet, Platform } from "react-native";
import {
  ActivityIndicator,
  Text,
  TextInput,
  Button,
  Card,
  IconButton,
  useTheme,
} from "react-native-paper";
import { SectionList, Switch } from "react-native";

import { useAuth } from "../auth/useAuth";
import { fetchCatalog } from "../services/catalogService";
import { saveSubmissionAndUpdateCounts } from "../services/inventoryService";
import { useInventory } from "../hooks/useInventory";
import SpeechModal from "../components/SpeechBar";
import { parseSpeechToLines } from "../services/speechParser";
import type { CatalogItem } from "../types/catalog";
import MicButton from "../components/MicButton";
import ConfirmChipsSheet from "../components/ConfirmChipsSheet";
import { useLocationSections } from "../hooks/useLocationSections";

export default function InventoryInputScreen() {
  const { user } = useAuth();

  // Theme colors
  const { colors } = useTheme();
  const NAVY = colors.primary; // headings + labels

  const [useRoute, setUseRoute] = useState(true);

  const { sections: routeSections, loading: loadingSections } =
    useLocationSections(user?.locationId);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const { rows: currentRows, loading: loadingInventory } = useInventory(user?.locationId);

  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // itemId -> qty text

  const [speechModalVisible, setSpeechModalVisible] = useState(false);
  const [changedInputs, setChangedInputs] = useState<Set<string>>(new Set());

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingParsed, setPendingParsed] = useState<{ itemId: string; qty: number }[]>([]);

  const [speechAnalysis, setSpeechAnalysis] = useState<{
    rawText: string;
    unrecognizedParts: string[];
    parsedItems: string[];
  } | null>(null);

  const SCALE = Platform.select({ ios: 0.66, android: 0.66 });

  const currentQtyByItem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of currentRows) m[r.itemId] = r.qty;
    return m;
  }, [currentRows]);

  useEffect(() => {
    fetchCatalog()
      .then((arr: CatalogItem[]) => {
        const sorted = [...arr].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
        setItems(sorted);
        setDrafts(Object.fromEntries(sorted.map((it) => [it.id, ""]))); // start empty
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const linesToSave = useMemo(() => {
    const out: { itemId: string; qty: number }[] = [];
    for (const it of items) {
      const txt = (drafts[it.id] ?? "").trim();
      if (txt === "") continue; // untouched
      const num = Number(txt);
      if (!Number.isFinite(num)) continue;
      const prev = currentQtyByItem[it.id];
      if (prev !== undefined && prev === num) continue; // no actual change
      out.push({ itemId: it.id, qty: num });
    }
    return out;
  }, [items, drafts, currentQtyByItem]);

  const resolvedSections = useMemo(() => {
    if (!useRoute || !routeSections.length) return null;
    const byId = new Map(items.map((i) => [i.id, i]));
    return routeSections
      .map((sec) => ({
        title: sec.name,
        data: (sec.itemIds || []).map((id) => byId.get(id)).filter(Boolean) as CatalogItem[],
      }))
      .filter((sec) => sec.data.length);
  }, [useRoute, routeSections, items]);

  async function handleSave() {
    if (!user || linesToSave.length === 0) return;
    setSaving(true);
    try {
      await saveSubmissionAndUpdateCounts({
        locationId: user.locationId,
        updatedBy: user.uid,
        lines: linesToSave,
      });
      // clear only the edited rows
      setDrafts((d) => {
        const copy = { ...d };
        for (const { itemId } of linesToSave) copy[itemId] = "";
        return copy;
      });
      setChangedInputs(new Set());
      setSpeechAnalysis(null);
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
    setPendingParsed(parsed);
    setConfirmVisible(true);
  }

  function applyApprovedLines(approved: { itemId: string; qty: number }[]) {
    const changedItemIds = new Set(changedInputs);
    for (const line of approved) changedItemIds.add(line.itemId);
    setChangedInputs(changedItemIds);

    setDrafts((d) => {
      const copy = { ...d };
      for (const line of approved) copy[line.itemId] = String(line.qty);
      return copy;
    });
  }

  function analyzeSpeechText(rawText: string, parsed: any[], catalog: CatalogItem[]) {
    const lowerText = String(rawText || "").toLowerCase();
    const recognizedParts: string[] = [];
    const toArray = <T,>(x: T | T[] | null | undefined): T[] =>
      Array.isArray(x) ? x : x == null ? [] : [x as T];

    for (const line of Array.isArray(parsed) ? parsed : []) {
      const item = catalog.find((i) => i.id === line.itemId);
      const itemName = String(item?.name ?? item?.id ?? "").trim();
      if (itemName) recognizedParts.push(`${line.qty} ${itemName}`);
      for (const syn of toArray<string>(item?.synonyms as any)) {
        const s = String(syn || "").trim();
        if (s) recognizedParts.push(s);
      }
    }

    const unrecognizedParts: string[] = [];
    const words = lowerText.split(/\s+/);
    const filter = new Set(["and", "the", "a", "an", "to", "of", "in", "for", "with", "on"]);
    let current: string[] = [];
    for (const w of words) {
      const isFilter = filter.has(w);
      let ok = false;
      for (const p of recognizedParts) {
        if (p.toLowerCase().includes(w)) {
          ok = true;
          break;
        }
      }
      if (!ok && !isFilter) current.push(w);
      else if (current.length) {
        unrecognizedParts.push(current.join(" "));
        current = [];
      }
    }
    if (current.length) unrecognizedParts.push(current.join(" "));
    return {
      rawText,
      unrecognizedParts,
      parsedItems: (Array.isArray(parsed) ? parsed : []).map((p) => {
        const item = catalog.find((i) => i.id === p.itemId);
        return `${p.qty} ${String(item?.name ?? p.itemId)}`;
      }),
    };
  }

  // Track edits; if equals original or blank, clear draft
  function handleInputChange(itemId: string, raw: string) {
    const clean = raw.replace(/[^\d.]/g, "");
    const original = currentQtyByItem[itemId];
    const originalText = original != null ? String(original) : "";
    const isChanged = clean !== "" && clean !== originalText;

    setChangedInputs((prev) => {
      const next = new Set(prev);
      if (isChanged) next.add(itemId);
      else next.delete(itemId);
      return next;
    });

    setDrafts((d) => ({ ...d, [itemId]: isChanged ? clean : "" }));
  }

  const baseLoading = loadingCatalog || loadingInventory;
  const combinedLoading = baseLoading || (useRoute && loadingSections);

  if (!user) {
    return (
      <View style={styles.pad}>
        <Text>Sign in required.</Text>
      </View>
    );
  }
  if (combinedLoading) {
    return (
      <View style={styles.pad}>
        <ActivityIndicator />
      </View>
    );
  }

  // ---- render one row ----
  const renderLine = (item: CatalogItem) => {
    const placeholder =
      currentQtyByItem[item.id] != null ? String(currentQtyByItem[item.id]) : "—";

    const draftText = drafts[item.id] ?? "";
    const isChanged = changedInputs.has(item.id) && draftText !== "";

    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: NAVY }]}>{item.name ?? item.id}</Text>

            <TextInput
              mode="outlined"
              keyboardType="numeric"
              placeholder={placeholder}
              value={drafts[item.id] ?? ""}
              onChangeText={(t) => handleInputChange(item.id, t)}
              // changed -> primary, otherwise leave default
              {...(isChanged ? { textColor: NAVY } : {})}
              style={[styles.input, isChanged && styles.changedInput]}
              contentStyle={[styles.inputContent, isChanged && styles.changedContent]}
              outlineStyle={styles.inputOutline}
              dense
            />

            <Text style={styles.unit}>{item.defaultUnit ?? "each"}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text variant="titleLarge" style={{ marginBottom: 6, color: NAVY }}>
            Inventory Entry
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ opacity: 0.8 }}>Optimized Route</Text>
            <Switch
              value={useRoute}
              onValueChange={setUseRoute}
              style={{
                transform: [{ scaleX: SCALE! }, { scaleY: SCALE! }],
                marginVertical: Platform.OS === "ios" ? -2 : 0,
              }}
            />
          </View>
        </View>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || linesToSave.length === 0}
          compact
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          Save
        </Button>
      </View>
      <View style={{ height: 1, backgroundColor: "#e0e0e0", marginVertical: 0 }} />

      {speechAnalysis && speechAnalysis.unrecognizedParts.length > 0 && (
        <View style={styles.speechAnalysis}>
          <View style={styles.speechAnalysisHeader}>
            <Text style={styles.speechAnalysisTitle}>Unrecognized Text</Text>
            <IconButton icon="close" size={20} onPress={() => setSpeechAnalysis(null)} style={styles.dismissButton} />
          </View>
          <View style={styles.speechTextContainer}>
            <Text style={styles.speechText}>{speechAnalysis.unrecognizedParts.join(", ")}</Text>
          </View>
          <Text style={styles.speechAnalysisNote}>
            This text wasn't recognized. You may want to check these items manually.
          </Text>
        </View>
      )}

      {useRoute && resolvedSections && resolvedSections.length > 0 ? (
        <SectionList
          sections={resolvedSections}
          keyExtractor={(it) => it.id}
          style={{ flex: 1, width: "100%", alignSelf: "stretch" }}
          contentContainerStyle={styles.listContainer}
          scrollIndicatorInsets={{ right: -24 }}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionHeader={({ section }) => (
            <View style={{ paddingVertical: 6, paddingHorizontal: 4, marginTop: 15 }}>
              <Text variant="titleMedium" style={{ color: NAVY }}>
                {section.title}
              </Text>
              <View style={{ height: 1, backgroundColor: "#e0e0e0", marginTop: 10 }} />
            </View>
          )}
          renderItem={({ item }) => renderLine(item)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          style={{ flex: 1, width: "100%", alignSelf: "stretch" }}
          contentContainerStyle={styles.listContainer}
          scrollIndicatorInsets={{ right: -24 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => renderLine(item)}
        />
      )}

      <ConfirmChipsSheet
        visible={confirmVisible}
        onDismiss={() => setConfirmVisible(false)}
        parsed={pendingParsed}
        catalog={items}
        onApply={applyApprovedLines}
      />

      <MicButton onPress={() => setSpeechModalVisible(true)} />

      <SpeechModal
        visible={speechModalVisible}
        onDismiss={() => setSpeechModalVisible(false)}
        onConfirm={handleSpeechConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  pad: { padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  titleSection: { flex: 1, marginRight: 16 },
  saveButton: { alignSelf: "flex-start", borderRadius: 15 },
  saveButtonContent: { paddingHorizontal: 8, paddingVertical: 0 },
  listContainer: { paddingVertical: 8 },
  card: {
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    backgroundColor: "#fff",
  },
  cardContent: { paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { flex: 1, fontSize: 16 },
  input: { width: 80 },
  inputContent: { borderRadius: 16 },
  inputOutline: { borderRadius: 16 },
  unit: { width: 70, opacity: 0.6 },
  separator: { height: 8 },
  changedInput: { backgroundColor: "#e8eefc" },
  changedContent: { backgroundColor: "#e8eefc" },
  speechAnalysis: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffeaa7",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  speechAnalysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  speechAnalysisTitle: { fontSize: 14, fontWeight: "600", color: "#856404", flex: 1 },
  dismissButton: { margin: 0, width: 20, height: 20 },
  speechTextContainer: { backgroundColor: "#fff", borderRadius: 4, padding: 8, marginBottom: 8 },
  speechText: { fontSize: 13, lineHeight: 18, color: "#333" },
  speechAnalysisNote: { fontSize: 11, color: "#856404", fontStyle: "italic" },
});
