import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { FlatList as GHFlatList } from "react-native-gesture-handler";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import {
  Button,
  Text,
  Card,
  IconButton,
  Divider,
  ActivityIndicator,
  TextInput,
  TouchableRipple,   // <-- add
} from "react-native-paper";
import { useAuth } from "../auth/useAuth";
import { useLocationSections, type LocationSection } from "../hooks/useLocationSections";
import {
  addItemsToSection,
  createSection,
  deleteSection,
  renameSection,
  reorderSections,
  removeItemFromSection,
} from "../services/sectionsService";
import { fetchCatalog } from "../services/catalogService";
import MultiSelectModal from "../components/MultiSelectModal";
import type { CatalogItem } from "../types/catalog";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ManagerRouteBuilderScreen() {
  const { user } = useAuth();
  const { sections, loading } = useLocationSections(user?.locationId);
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [pickerInitialSelected, setPickerInitialSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);

  // NEW: collapsed state (ids of collapsed sections)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const listRef = useRef<GHFlatList<LocationSection> | null>(null);

  requestAnimationFrame(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
    listRef.current?.scrollToIndex?.({ index: 0, animated: true });
  });

  useEffect(() => {
    fetchCatalog().then(setCatalog);
  }, []);

  if (!user) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Sign in required.</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={{ padding: 24 }}>
        <ActivityIndicator />
      </View>
    );
  }

  const empty = sections.length === 0;

  async function handleCreate() {
    if (!user?.locationId) return;
    setAdding(true);
    try {
      const newId = await createSection(user.locationId, "New Section");
      const newOrder = [newId, ...sections.map((s) => s.id)];
      await reorderSections(user.locationId, newOrder);
      setRenamingId(newId);
      setRenameText("New Section");
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
      });
    } finally {
      setAdding(false);
    }
  }

  async function commitRename(id: string) {
    if (!user?.locationId) return;
    setBusy(true);
    await renameSection(user.locationId, id, renameText.trim() || "Section");
    setBusy(false);
    setRenamingId(null);
    Keyboard.dismiss();
  }

  async function handleReorder(newData: LocationSection[]) {
    if (!user?.locationId) return;
    await reorderSections(user.locationId, newData.map((s) => s.id));
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameText(currentName);
  }

  async function openAddItems(sectionId: string) {
    setPickerTarget(sectionId);
    const sec = sections.find((s) => s.id === sectionId);
    setPickerInitialSelected(sec?.itemIds ?? []);
    setPickerOpen(true);
  }

  async function confirmAddItems(ids: string[]) {
    if (!user?.locationId || !pickerTarget) return;
    setBusy(true);
    await addItemsToSection(user.locationId, pickerTarget, ids);
    setBusy(false);
    setPickerOpen(false);
    setPickerTarget(null);
  }

  async function handleRemoveItem(sectionId: string, itemId: string) {
    if (!user?.locationId) return;
    setBusy(true);
    await removeItemFromSection(user.locationId, sectionId, itemId);
    setBusy(false);
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<LocationSection>) => {
    const isRenaming = renamingId === item.id;
    const isCollapsed = collapsedIds.has(item.id);

    return (
      <Card style={{ marginBottom: 12, opacity: isActive ? 0.9 : 1 }}>
        <Card.Content>
          {/* Header row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 0, paddingBottom: 6 }}>
            {isRenaming ? (
              <TextInput
                mode="outlined"
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => commitRename(item.id)}
                style={{ flex: 1 }}
                dense
                right={
                  <TextInput.Icon
                    icon={renameText ? "close-circle" : "close-circle-outline"}
                    onPress={() => setRenameText("")}
                    forceTextInputFocus={false}
                    accessibilityLabel="Clear name"
                  />
                }
              />
            ) : (
              // Tappable left side toggles collapse
              <TouchableRipple
                onPress={() => toggleCollapsed(item.id)}
                style={{ flex: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 0 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconButton
                    icon={isCollapsed ? "chevron-right" : "chevron-down"}
                    size={20}
                    style={{ margin: 0, marginRight: 2 }}
                  />
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", paddingLeft: 0 }} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              </TouchableRipple>
            )}

            {isRenaming ? (
              <IconButton icon="check" onPress={() => commitRename(item.id)} disabled={busy} />
            ) : (
              <>
                <IconButton icon="pencil" onPress={() => startRename(item.id, item.name)} style={{ margin: 0 }} />
                <IconButton icon="plus" onPress={() => openAddItems(item.id)} style={{ margin: 0 }} />
                <IconButton icon="drag" onLongPress={drag} style={{ margin: 0 }} />
                <IconButton icon="delete" onPress={() => deleteSection(user.locationId!, item.id)} style={{ margin: 0 }} />
              </>
            )}
          </View>

          {/* Items list (hidden when collapsed) */}
          {!isCollapsed && (
            item.itemIds.length === 0 ? (
              <Text style={{ opacity: 0.6 }}>No items yet. Tap “+” to add.</Text>
            ) : (
              <View>
                <Divider />
                {item.itemIds.map((id) => {
                  const it = catalog.find((c) => c.id === id);
                  return (
                    <View
                      key={id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{paddingLeft: 40}}>{it?.name ?? id}</Text>
                      <IconButton icon="close" onPress={() => handleRemoveItem(item.id, id)} />
                    </View>
                  );
                })}
              </View>
            )
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={{ flex: 1, padding: 16 }}>
        {sections.length === 0 ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <Text variant="titleLarge" style={{ marginBottom: 8 }}>
              Create your first section
            </Text>
            <Text style={{ opacity: 0.8, marginBottom: 16 }}>
              Start with a blank slate: add “Small Freezer”, then add items, create “Small Fridge”, and drag to reorder.
            </Text>
            <Button mode="contained" onPress={handleCreate} loading={adding}>
              Add Section
            </Button>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, paddingTop: 8 }}>
              <Text variant="titleLarge" style={{ paddingLeft: 8 }}>Route Builder</Text>
              <Button
                mode="contained"
                onPress={handleCreate}
                loading={adding}
                contentStyle={{ height: 32, paddingHorizontal: 10, paddingVertical: 0 }}
                labelStyle={{ fontSize: 13, lineHeight: 16 }}
              >
                Add Section
              </Button>
            </View>

            <DraggableFlatList<LocationSection>
              ref={listRef}
              data={sections}
              keyExtractor={(s) => s.id}
              onDragEnd={({ data }) => handleReorder(data)}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              activationDistance={renamingId ? 9999 : 0}
              containerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              persistentScrollbar={false}
            />
          </>
        )}

        <MultiSelectModal
          visible={pickerOpen}
          onDismiss={() => setPickerOpen(false)}
          items={catalog}
          initialSelected={pickerInitialSelected}
          onConfirm={confirmAddItems}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
