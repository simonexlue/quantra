import React, { useMemo, useState, useEffect } from "react";
import { View, Keyboard } from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import {
  Button,
  Text,
  Card,
  IconButton,
  Divider,
  ActivityIndicator,
  TextInput,
} from "react-native-paper";
import { useAuth } from "../auth/useAuth";
import { useLocationSections } from "../hooks/useLocationSections";
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
import type { LocationSection } from "../hooks/useLocationSections";


export default function ManagerRouteBuilderScreen() {
  const { user } = useAuth();
  const { sections, loading } = useLocationSections(user?.locationId);
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pickerInitialSelected, setPickerInitialSelected] = useState<string[]>([]);

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
    const id = await createSection(user.locationId, "New Section");
    setAdding(false);
    setRenamingId(id);
    setRenameText("New Section");
  }

  async function commitRename(id: string) {
    if (!user?.locationId) return;
    setBusy(true);
    await renameSection(user.locationId, id, renameText.trim() || "Section");
    setBusy(false);
    setRenamingId(null);
    Keyboard.dismiss();
  }

  async function handleReorder(newData: typeof sections) {
    if (!user?.locationId) return;
    await reorderSections(user.locationId, newData.map((s) => s.id));
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameText(currentName);
  }

  async function openAddItems(sectionId: string) {
    setPickerTarget(sectionId);
    // grab the current section's itemIds so the modal can reflect already-added items
    const sec = sections.find(s => s.id === sectionId);
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

    return (
      <Card style={{ marginBottom: 12, opacity: isActive ? 0.9 : 1 }}>
        <Card.Content>
          {/* Header row: editable name field (NOT in Card.Title) + actions + drag handle */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingBottom: 6,
            }}
          >
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
              />
            ) : (
              <Text style={{ flex: 1, fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
            )}

            {isRenaming ? (
              <IconButton icon="check" onPress={() => commitRename(item.id)} disabled={busy} />
            ) : (
              <>
                <IconButton icon="pencil" onPress={() => startRename(item.id, item.name)} />
                <IconButton icon="plus" onPress={() => openAddItems(item.id)} />
                {/* Drag handle: ONLY this triggers drag */}
                <IconButton icon="drag" onLongPress={drag} />
                <IconButton
                  icon="delete"
                  onPress={() => deleteSection(user.locationId!, item.id)}
                />
              </>
            )}
          </View>

          {/* Items list for this section */}
          {item.itemIds.length === 0 ? (
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
                    <Text>{it?.name ?? id}</Text>
                    <IconButton icon="close" onPress={() => handleRemoveItem(item.id, id)} />
                  </View>
                );
              })}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {empty ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 20}}>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <Text variant="titleLarge">Route Builder</Text>
            <Button mode="contained" onPress={handleCreate} loading={adding}>
              Add Section
            </Button>
          </View>

          <DraggableFlatList
            data={sections}
            keyExtractor={(s) => s.id}
            onDragEnd={({ data }) => handleReorder(data)}
            renderItem={renderItem}
            // keep keyboard while tapping inputs, and don't start drag while renaming
            keyboardShouldPersistTaps="handled"
            activationDistance={renamingId ? 9999 : 0}
            // makes typing smoother by not scrolling the list as you type
            containerStyle={{ paddingBottom: 16 }}
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
  );
}
