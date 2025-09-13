import React, { useState, useEffect } from "react";
import { FlatList, View } from 'react-native';
import { List, Divider } from 'react-native-paper';
import { db } from '../services/firebase';
import { useAuth } from '../auth/useAuth';
import { collection, query, where, orderBy, limit, onSnapshot } from "@react-native-firebase/firestore";


type Line = { itemId: string; qty: number; flag?: 'ok'|'low'|'critical'|'out' };

export default function InventoryListScreen() {

    const { user } = useAuth();
    const [lines, setLines] = useState<Line[]>([]); 

    // Runs whenever user location changes
    // Builds firestore query filtered by location, sorted by submitted date and only shows the most recent 
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'inventoryCounts'),
            where('locationId', '==', user.locationId),
            orderBy('submittedAt', 'desc'),
            limit(1)
        );

        const unsub = onSnapshot(q, (s) => {
            if (s.empty) {
                setLines([]);
                return;
            }
            const doc = s.docs[0];
            const data = doc.data() as { lines?: Line[] | undefined };
            setLines(data.lines ?? []);
        });

        return unsub;
    }, [user?.locationId]);
    
    return (
        <FlatList
            data={lines}
            keyExtractor={(i, idx) => i.itemId ?? String(idx)}
            ItemSeparatorComponent={() => <Divider />}
            renderItem={({item}: {item: any}) => (
                <List.Item
                    title={item.itemId}
                    description={`Qty: ${item.qty}`}
                    right={() => (
                        <View style={{ paddingRight: 12}}>
                            <List.Subheader>{(item.flag || 'ok' ).toUpperCase()}</List.Subheader>
                        </View>
                    )}
                />
            )}
            />
        );
}