import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { Capacitor } from '@capacitor/core';
import webFirebaseConfig from './VITE_firebaseConfig';

let config;
// Use the web config for all platforms (including Capacitor)
config = webFirebaseConfig;

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Set auth persistence based on platform
if (Capacitor.getPlatform() === 'web') {
  // Use localStorage persistence for web browsers (including Capacitor WebView)
  setPersistence(auth, browserLocalPersistence);
} else {
  // Use indexedDB persistence for native platforms
  setPersistence(auth, indexedDBLocalPersistence);
}

// Initialize analytics for all platforms (web and mobile)
export const analytics = getAnalytics(app);