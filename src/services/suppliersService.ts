import { collection, getDocs, doc, collectionGroup } from '@react-native-firebase/firestore';
import { db } from '../services/firebase';
import { COL } from '../constants/collections';
import type { Supplier, SupplierContact } from '../types/catalog';

export async function fetchSuppliers(): Promise<Supplier[]> {
    const snap = await getDocs(collection(db, COL.suppliers));
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Supplier[];
  }

export async function fetchSupplierContacts(supplierId: string): Promise<SupplierContact[]> {
    const snap = await getDocs(collection(doc(collection(db, COL.suppliers), supplierId), 'contacts'));
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as SupplierContact[];
  }