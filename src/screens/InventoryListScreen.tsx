import React, { useState, useEffect } from "react";
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Text, List, Divider } from 'react-native-paper';
import { db } from '../services/firebase';
import { useAuth } from '../auth/useAuth';
import { collection, query, where, orderBy, limit, onSnapshot } from "@react-native-firebase/firestore";
import FlagPill from "../components/FlagPill";
import { useInventory } from "../hooks/useInventory";


type Line = { itemId: string; qty: number; flag?: 'ok'|'low'|'critical'|'out' };

export default function InventoryListScreen() {

    const { user } = useAuth();
    const [lines, setLines] = useState<Line[]>([]); 

    // Runs whenever user location changes
    // Builds firestore query filtered by location, sorted by submitted date and only shows the most recent 
    useEffect(() => {
        if (!user) {
            setLines([]);
            return;
        }

        // minimal logging

        // Simplified query that doesn't require an index
        const q = query(
            collection(db, 'inventoryCounts'),
            where('locationId', '==', user.locationId)
        );

        const unsub = onSnapshot(q, (s) => {
            
            // Check if snapshot is null or has error
            if (!s) {
                console.error('[debug] snapshot null');
                setLines([]);
                return;
            }
            
            if (!s || s.docs.length === 0) {
                setLines([]);
                return;
            }
            
            // Sort by submittedAt in JavaScript and get the most recent
            const docs = s.docs.sort((a: any, b: any) => {
                const aTime = a.data().submittedAt?.toMillis() || 0;
                const bTime = b.data().submittedAt?.toMillis() || 0;
                return bTime - aTime; // Most recent first
            });
            
            const mostRecentDoc = docs[0];
            const data = mostRecentDoc.data() as { lines?: Line[] | undefined };
            setLines(data.lines ?? []);
        }, (error) => {
            console.error('[debug] firestore error', error);
            setLines([]);
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