import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';
import webFirebaseConfig from './VITE_firebaseConfig';

// Note: avoid static import of DatabaseMonitoringService here to prevent a
// circular initialization (databaseMonitoringService imports `db` from
// this module). We'll dynamically import and initialize it after `db`
// is created.

let config;
// Use the web config for all platforms (including Capacitor)
config = webFirebaseConfig;

const app = initializeApp(config);
export const auth = getAuth(app);
// Temporarily enable app verification for production builds
// auth.settings = {
//   appVerificationDisabledForTesting: true
// };
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize database monitoring asynchronously to avoid circular import
// issues. This will attempt to initialize monitoring but won't block
// startup on failure.
// (async () => {
//   try {
//     const mod = await import('./services/databaseMonitoringService');
//     if (mod && typeof mod.default?.initializeMonitoring === 'function') {
//       mod.default.initializeMonitoring();
//     }
//   } catch (err: any) {
//     console.warn('DatabaseMonitoringService failed to initialize (deferred):', err?.message || err);
//   }
// })();

// Initialize messaging (FCM) - only on supported platforms
let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch(error => {
    console.log('FCM not supported:', error);
  });
}
export { messaging };

// Set auth persistence based on platform
if (Capacitor.getPlatform() === 'web') {
  // Use localStorage persistence for web browsers (including Capacitor WebView)
  setPersistence(auth, browserLocalPersistence);
} else {
  // Use indexedDB persistence for native platforms
  setPersistence(auth, indexedDBLocalPersistence);
}

// Initialize analytics only if measurementId is configured
let analytics: any;
if ((config as any)?.measurementId) {
  analytics = getAnalytics(app);
}
export { analytics };
