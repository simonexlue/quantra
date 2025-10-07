import { useEffect, useState } from "react";
import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "@react-native-firebase/firestore";

export type LocationSection = {
  id: string;
  name: string;
  order: number;
  itemIds: string[];
};

export function useLocationSections(locId?: string | null) {
  const [sections, setSections] = useState<LocationSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locId) {
      setSections([]);
      setLoading(false);
      return;
    }

    const db = getFirestore(getApp());
    const sectionsRef = collection(db, "locations", locId, "sections");
    const q = query(sectionsRef, orderBy("order", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const arr: LocationSection[] = snap.docs.map((docSnap: any) => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: d?.name ?? "Section",
          order: d?.order ?? 9999,
          itemIds: Array.isArray(d?.itemIds) ? d.itemIds : [],
        };
      });
      setSections(arr);
      setLoading(false);
    });

    return unsub;
  }, [locId]);

  return { sections, loading };
}
