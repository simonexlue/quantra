import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from '@react-native-firebase/firestore';
import { COL} from '../constants/collections';
import type { InventoryCountDoc } from '../types/inventory';
import type { CatalogItem } from '../types/catalog';
import { db } from '../services/firebase';

export type InventoryRowWithName = InventoryCountDoc & {
    itemName: string;
    defaultUnit?: string;
};

export function useInventory(locationId?: string) {
    const [rows, setRows] = useState<InventoryRowWithName[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);

    // Subscribe to real-time catalog updates
    useEffect(() => {
        const catalogUnsub = onSnapshot(collection(db, COL.items), (snap) => {
            const catalogData = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as CatalogItem[];
            setCatalog(catalogData);
        });
        return catalogUnsub;
    }, []);

    useEffect(()=> {
        if(!locationId) return;

        const q = query(
            collection(db, COL.currentInventory),
            where('locationId', '==', locationId)
        );

        const unsub = onSnapshot(q, (snap) => {
            const inventoryData = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any)}));
            
            // Create catalog map from real-time catalog data
            const catalogMap = new Map<string, { name: string; defaultUnit?: string }>(
                catalog.map((item: CatalogItem) => [item.id, { name: item.name, defaultUnit: item.defaultUnit }])
            );
            
            const rowsWithNames = inventoryData.map((item: InventoryCountDoc) => {
                const catalogEntry = catalogMap.get(item.itemId);
                return {
                    ...item,
                    itemName: catalogEntry?.name || item.itemId, // fallback to itemId if name not found
                    defaultUnit: catalogEntry?.defaultUnit,
                };
            });
            
            rowsWithNames.sort((a: any, b: any) => a.itemName.localeCompare(b.itemName));
            setRows(rowsWithNames as InventoryRowWithName[]);
            setLoading(false);
        });
        return unsub;
    }, [locationId, catalog]);

    return { rows, loading };
}