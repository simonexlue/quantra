// src/services/firebase.ts
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

export const app = getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
