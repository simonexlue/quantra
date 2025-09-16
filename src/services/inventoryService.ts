import { collection, doc, writeBatch, serverTimestamp, addDoc } from '@react-native-firebase/firestore';
import { COL } from '../constants/collections';
import { computeFlag } from '../constants/flags';
import { db } from '../services/firebase';

type LineIn = { itemId: string; qty: number};

const snapId = (locationId: string, itemId: string) => `${locationId}_${itemId}`;

export async function saveSubmissionAndUpdateCounts(params: {
    locationId: string;
    updatedBy: string;
    lines: LineIn[];
}) {
    const { locationId, updatedBy, lines } = params;
    const batch = writeBatch(db);
    const now = serverTimestamp();
    console.log('[debug] starting save', { locationId, updatedBy, numLines: lines.length });

    // Add the submission in inventoryCounts collection
    const withFlags = lines.map(l => ({ ...l, flag: computeFlag(l.qty) }));
    // First create the submission as a standalone write to isolate permission issues
    const submissionPayload = {
        locationId,
        userId: updatedBy,
        submittedAt: now,
        lines: withFlags,
    };
    try {
        await addDoc(collection(db, COL.inventorySubmissions), submissionPayload);
        console.log('[debug] submission created');
    } catch (e) {
        console.error('[debug] submission create failed', e);
        throw e;
    }

    // Upsert per-item snapshot in currentInventory collection
    for (const {itemId, qty} of withFlags) {
        const ref = doc(collection(db, COL.currentInventory), snapId(locationId, itemId));
        batch.set(
            ref,
            { itemId, locationId, qty, flag: computeFlag(qty), updatedBy, updatedAt: now},
            { merge: true}
        );
    }

    try {
        await batch.commit();
        console.log('[debug] save complete');
    } catch (error) {
        console.error('[debug] save failed', error);
        throw error;
    }
}