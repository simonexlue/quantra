import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from '@react-native-firebase/firestore';
import { COL} from '../constants/collections';
import type { InventoryCountDoc } from '../types/inventory';
import type { CatalogItem } from '../types/catalog';
import { db } from '../services/firebase';
import { fetchCatalog } from '../services/catalogService';

export type InventoryRowWithName = InventoryCountDoc & {
    itemName: string;
};

export function useInventory(locationId?: string) {
    const [rows, setRows] = useState<InventoryRowWithName[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(()=> {
        if(!locationId) return;

        const q = query(
            collection(db, COL.currentInventory),
            where('locationId', '==', locationId)
        );

        const unsub = onSnapshot(q, async (snap) => {
            const inventoryData = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any)}));
            
            try {
                const catalog = await fetchCatalog();
                const catalogMap = new Map(catalog.map((item: CatalogItem) => [item.id, item.name]));
                
                const rowsWithNames = inventoryData.map((item: InventoryCountDoc) => ({
                    ...item,
                    itemName: catalogMap.get(item.itemId) || item.itemId // fallback to itemId if name not found
                }));
                
                rowsWithNames.sort((a: any, b: any) => a.itemName.localeCompare(b.itemName));
                setRows(rowsWithNames as InventoryRowWithName[]);
            } catch (error) {
                // Fallback to itemId if catalog fetch fails
                const fallbackRows = inventoryData.map((item: InventoryCountDoc) => ({
                    ...item,
                    itemName: item.itemId
                }));
                fallbackRows.sort((a: any, b: any) => a.itemId.localeCompare(b.itemId));
                setRows(fallbackRows as InventoryRowWithName[]);
            }
            
            setLoading(false);
        });
        return unsub;
    }, [locationId]);

    return { rows, loading };
}