import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, addDoc, onSnapshot } from '@react-native-firebase/firestore';
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

    // location overrides
    const overrides = await fetchLocationOverrides(locationId);

    // Add the submission in inventoryCounts collection
    const withFlags = lines.map((l) => ({
        ...l,
        flag: computeFlag(l.qty, { low: overrides[l.itemId]?.lowThreshold }),
      }));
    // First create the submission as a standalone write to isolate permission issues
    const submissionPayload = {
        locationId,
        userId: updatedBy,
        submittedAt: now,
        lines: withFlags,
    };
    try {
        await addDoc(collection(db, COL.inventorySubmissions), submissionPayload);
    } catch (e) {
        throw e;
    }

    // Upsert per-item snapshot in currentInventory collection
    for (const {itemId, qty} of withFlags) {
        const ref = doc(collection(db, COL.currentInventory), snapId(locationId, itemId));
        batch.set(
            ref,
            { 
                itemId, 
                locationId, 
                qty, 
                flag: computeFlag(qty, { low: overrides[itemId]?.lowThreshold }), 
                updatedBy, 
                updatedAt: now},
            { merge: true}
        );
    }

    try {
        await batch.commit();
    } catch (error) {
        throw error;
    }
}

export type LocationOverrides = Record<string, { lowThreshold: number }>;

export function subscribeLocationOverrides(
    locationId: string,
    cb: (overrides: LocationOverrides) => void
  ) {
    const locRef = doc(collection(db, COL.locations), locationId);
    const cfgCol = collection(locRef, 'itemConfig');
    return onSnapshot(cfgCol, (snap) => {
      const map: LocationOverrides = {};
      snap.forEach((d: any) => {
        const dt = d.data() as any;
        if (typeof dt.lowThreshold === 'number') {
          map[d.id] = { lowThreshold: dt.lowThreshold };
          console.log(`Subscribed override for ${d.id}: ${dt.lowThreshold}`);
        }
      });
      console.log(`Subscribed overrides for location ${locationId}:`, map);
      cb(map);
    });
  }

export async function fetchLocationOverrides(locationId: string): Promise<LocationOverrides> {
  const locRef = doc(collection(db, COL.locations), locationId);
  const cfgCol = collection(locRef, 'itemConfig');
  const snap = await getDocs(cfgCol);
  const byId: LocationOverrides = {};
  if (snap && snap.docs) {
    snap.docs.forEach((d: any) => {
      const dt = d.data() as any;
      if (typeof dt.lowThreshold === 'number') {
        byId[d.id] = { lowThreshold: dt.lowThreshold };
        console.log(`Found override for ${d.id}: ${dt.lowThreshold}`);
      }
    });
  }
  console.log(`Fetched overrides for location ${locationId}:`, byId);
  return byId;
}

export async function setItemLowThreshold(
  locationId: string,
  itemId: string,
  lowThreshold: number | null
) {
  const locRef = doc(collection(db, COL.locations), locationId);
  const cfgRef = doc(collection(locRef, 'itemConfig'), itemId);

  if (lowThreshold == null) {
    // clearing override → delete the doc to fall back to global
    await deleteDoc(cfgRef).catch(() => {});
  } else {
    await setDoc(cfgRef, { lowThreshold, updatedAt: serverTimestamp() }, { merge: true });
  }
}