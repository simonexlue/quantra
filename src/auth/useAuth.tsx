import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import { onAuthStateChanged, signOut as authSignOut } from "@react-native-firebase/auth";
import { collection, doc, getDoc} from "@react-native-firebase/firestore";

type AppUser = { uid: string; email: string | null; role: 'manager' | 'crew'; locationId: string; }
type Context = { user: AppUser | null; loading: boolean; signOut: () => Promise<void>; }

// Safe Default Context to prevent app crashes
const Context = createContext<Context>({ user: null, loading: true, signOut: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode}> = ({ children }) => {
    const [user, setUser] = useState<AppUser|null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth,async (user) => {

            // User is not logged in
            if (!user) {
                setUser(null);
                setLoading(false);
                return;
            }

            // User is logged in -> get profile from Firestore
            const userRef = doc(collection(db, 'users'), user.uid);
            const snap = await getDoc(userRef);

            // Reads with defaults 
            const userData = snap.data() as { role?: string; locationId?: string } | undefined;
            const role = snap.exists() ? (userData?.role ?? "crew") : "crew"; 
            const locationId = snap.exists() ? (userData?.locationId ?? "brewery-district") : "brewery-district";

            setUser({ uid: user.uid, email: user.email, role: role as 'manager' | 'crew', locationId});
            setLoading(false);
        });

        // Clean up listener on unmount
        return unsub;
    }, []);

    return <Context.Provider value={{ user, loading, signOut: () => authSignOut(auth) }}>{children}</Context.Provider>;
};

export const useAuth = () => useContext(Context);