import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  collection,
  doc,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "@react-native-firebase/firestore";

export interface SectionDoc {
  name: string;
  order: number;
  itemIds: string[];
}

function db() {
  return getFirestore(getApp());
}

function sectionsCol(locId: string) {
  return collection(db(), "locations", locId, "sections");
}

export async function createSection(locId: string, name: string) {
  const colRef = sectionsCol(locId);

  // next order = max(order) + 1
  const maxSnap = await getDocs(query(colRef, orderBy("order", "desc"), limit(1)));
  const top = maxSnap.docs[0]?.data() as Partial<SectionDoc> | undefined;
  const nextOrder = top?.order != null ? Number(top.order) + 1 : 1;

  const newRef = doc(colRef); // auto-id
  const payload: SectionDoc = { name, order: nextOrder, itemIds: [] };
  await setDoc(newRef, payload);
  return newRef.id;
}

export async function renameSection(locId: string, sectionId: string, name: string) {
  const ref = doc(sectionsCol(locId), sectionId);
  await updateDoc(ref, { name });
}

export async function deleteSection(locId: string, sectionId: string) {
  const ref = doc(sectionsCol(locId), sectionId);
  await deleteDoc(ref);
}

export async function reorderSections(locId: string, orderedIds: string[]) {
  const batch = writeBatch(db());
  orderedIds.forEach((id, idx) => {
    const ref = doc(sectionsCol(locId), id);
    batch.update(ref, { order: idx + 1 });
  });
  await batch.commit();
}

export async function addItemsToSection(locId: string, sectionId: string, itemIds: string[]) {
  const ref = doc(sectionsCol(locId), sectionId);
  const snap = await getDoc(ref);
  const data = snap.data() as Partial<SectionDoc> | undefined;

  const existing: string[] = Array.isArray(data?.itemIds) ? (data!.itemIds as string[]) : [];
  const merged = Array.from(new Set([...existing, ...itemIds]));
  await updateDoc(ref, { itemIds: merged });
}

export async function removeItemFromSection(locId: string, sectionId: string, itemId: string) {
  const ref = doc(sectionsCol(locId), sectionId);
  const snap = await getDoc(ref);
  const data = snap.data() as Partial<SectionDoc> | undefined;

  const existing: string[] = Array.isArray(data?.itemIds) ? (data!.itemIds as string[]) : [];
  await updateDoc(ref, { itemIds: existing.filter((id) => id !== itemId) });
}
