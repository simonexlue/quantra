import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from '@react-native-firebase/firestore';
import { COL} from '../constants/collections';
import type { InventoryCountDoc } from '../types/inventory';
import { db } from '../services/firebase';

export function useInventory(locationId: string) {
    const [rows, setRows] = useState<InventoryCountDoc[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(()=> {
        if(!locationId) return;

        const q = query(
            collection(db, COL.currentInventory),
            where('locationId', '==', locationId)
        );

        const unsub = onSnapshot(q, (snap) => {
            const next = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any)}));
            next.sort((a: any, b: any) => a.itemId.localeCompare(b.itemId));
            setRows(next as InventoryCountDoc[]);
            setLoading(false);
        });
        return unsub;
    }, [locationId]);

    return { rows, loading };
}