import { collection, getDocs } from '@react-native-firebase/firestore';
import { COL } from '../constants/collections';
import { db } from '../services/firebase';

export async function fetchCatalog() {
    const snap = await getDocs(collection(db, COL.items));
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any)}));
}