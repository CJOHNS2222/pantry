import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Capacitor } from '@capacitor/core';
import webFirebaseConfig from './VITE_firebaseConfig';
import { log } from './services/logService';

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

// Firebase App Check — prevents unauthorized clients from hitting Firestore/Storage.
// Requires VITE_RECAPTCHA_SITE_KEY in .env.local (web) or device attestation (native).
// In development, enable debug mode via: self.FIREBASE_APPCHECK_DEBUG_TOKEN = true (before initializeApp)
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (appCheckSiteKey && !import.meta.env.DEV) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err: unknown) {
    // Non-fatal: App Check failing won't break the app (Firestore rules still apply)
    log.warn('Firebase App Check initialization failed', { message: err instanceof Error ? err.message : String(err) });
  }
}

// Initialize database monitoring asynchronously to avoid circular import
// issues. This will attempt to initialize monitoring but won't block
// startup on failure.
(async () => {
  try {
    const mod = await import('./services/databaseMonitoringService');
    if (mod && typeof mod.default?.initializeMonitoring === 'function') {
      mod.default.initializeMonitoring();
    }
  } catch (err: any) {
    // Soft failure: warn in development only — monitoring services are non-critical on init
    if (import.meta.env.DEV) {
      log.warn('DatabaseMonitoringService failed to initialize (deferred)', { message: err?.message || err });
    }
  }
})();

// Initialize messaging (FCM) - only on supported platforms
let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch(error => {
    log.debug('FCM not supported:', error);
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
