import React, { useMemo, useState, useEffect } from "react";
import { View, FlatList} from 'react-native';
import { Button, Chip, Divider, Modal, Portal, Text, TextInput, Card} from 'react-native-paper';
import type { CatalogItem } from "../types/catalog";

export type ReviewLine = { itemId: string; qty: number; selected: boolean};

type Props = {
    visible: boolean;
    onDismiss: () => void;
    parsed: { itemId: string; qty: number}[];
    catalog: CatalogItem[];
    onApply: (approved: {itemId: string; qty: number}[]) => void;
}

export default function ConfirmChipsSheet({ visible, onDismiss, parsed, catalog, onApply }: Props) {
    const [lines, setLines] = useState<ReviewLine[]>([]);

    useEffect(() => {
        setLines(parsed.map(l => ({...l, selected: true})));
    }, [parsed]);

    const nameById = React.useMemo(() => new Map(catalog.map(c => [c.id, c.name ?? c.id])), [catalog]);

    function updateQty(i: number, v: string) {
      const qty = Number(v.replace(/[^0-9.-]/g, '')) || 0;
      setLines(prev => prev.map((l, idx) => idx === i ? { ...l, qty } : l));
    }
    function toggle(i: number) {
      setLines(prev => prev.map((l, idx) => idx === i ? { ...l, selected: !l.selected } : l));
    }
    function apply() {
      onApply(lines.filter(l => l.selected).map(({ selected, ...rest }) => rest));
      onDismiss();
    }

    return (
        <Portal>
          <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={{ margin: 16 }}>
            <Card>
              <Card.Title title="Review voice results" subtitle="Unselect or edit before applying" />
              <Card.Content>
                <FlatList
                  data={lines}
                  keyExtractor={(_, i) => `line-${i}`}
                  ItemSeparatorComponent={Divider}
                  renderItem={({ item, index }) => (
                    <View style={{ paddingVertical: 8, gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="titleMedium">{nameById.get(item.itemId) ?? item.itemId}</Text>
                        <Chip
                          mode={item.selected ? 'flat' : 'outlined'}
                          selected={item.selected}
                          icon={item.selected ? 'check' : undefined}
                          onPress={() => toggle(index)}
                        >
                          {item.selected ? 'Will apply' : 'Ignore'}
                        </Chip>
                      </View>
                      <TextInput
                        mode="outlined"
                        label="Qty"
                        keyboardType="number-pad"
                        value={String(item.qty)}
                        onChangeText={(t) => updateQty(index, t)}
                      />
                    </View>
                  )}
                />
              </Card.Content>
              <Card.Actions style={{ justifyContent: 'space-between' }}>
                <Button onPress={onDismiss}>Cancel</Button>
                <Button mode="contained" onPress={apply} disabled={lines.every(l => !l.selected)}>
                  Apply {lines.filter(l => l.selected).length}
                </Button>
              </Card.Actions>
            </Card>
          </Modal>
        </Portal>
      );
}