import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { Analytics } from "firebase/analytics";
import type { Functions } from "firebase/functions";
import type { Messaging } from "firebase/messaging";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Capacitor } from '@capacitor/core';
import webFirebaseConfig from './VITE_firebaseConfig';
import { log } from './services/logService';

// Note: avoid static import of DatabaseMonitoringService here to prevent a
// circular initialization (databaseMonitoringService imports `db` from
// this module). We'll dynamically import and initialize it after `db`
// is created.

// Use the web config for all platforms (including Capacitor)
const config = webFirebaseConfig;

const app = initializeApp(config);
export const auth = getAuth(app);
// Temporarily enable app verification for production builds
// auth.settings = {
//   appVerificationDisabledForTesting: true
// };
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);

// `firebase/functions` is dynamically imported on first use (see `getFunctionsInstance`)
// so it — and `firebase/messaging`/`firebase/analytics` below — don't get pulled into the
// eager `firebase-vendor` chunk alongside core `firebase/auth`/`firebase/firestore`, which
// blocks first paint (perf audit F35).
let functionsInstance: Functions | undefined;
let functionsInitPromise: Promise<Functions> | undefined;
export const getFunctionsInstance = (): Promise<Functions> => {
  if (functionsInstance) {
    return Promise.resolve(functionsInstance);
  }
  if (!functionsInitPromise) {
    functionsInitPromise = import('firebase/functions').then(({ getFunctions }) => {
      functionsInstance = getFunctions(app, 'us-east1');
      return functionsInstance;
    });
  }
  return functionsInitPromise;
};

// Convenience helper: resolves a callable Cloud Function without any caller needing a
// static `import { httpsCallable } from 'firebase/functions'` (which would otherwise pull
// the module back into the eager bundle regardless of `getFunctionsInstance` above).
export const getCallableFunction = async <RequestData = unknown, ResponseData = unknown>(
  name: string
) => {
  const [instance, { httpsCallable }] = await Promise.all([
    getFunctionsInstance(),
    import('firebase/functions'),
  ]);
  return httpsCallable<RequestData, ResponseData>(instance, name);
};

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
  } catch (err: unknown) {
    // Soft failure: warn in development only — monitoring services are non-critical on init
    if (import.meta.env.DEV) {
      log.warn('DatabaseMonitoringService failed to initialize (deferred)', { message: err instanceof Error ? err.message : String(err) });
    }
  }
})();

// Initialize messaging (FCM) - only on supported platforms. `firebase/messaging` is
// dynamically imported so it doesn't force-bundle into the eager firebase-vendor chunk.
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  import('firebase/messaging').then(({ isSupported, getMessaging }) => {
    return isSupported().then(supported => {
      if (supported) {
        messaging = getMessaging(app);
      }
    });
  }).catch(error => {
    log.debug('FCM not supported:', error);
  });
}
export { messaging };

// Set auth persistence based on platform.
// `setPersistence` is async - a sign-in call racing this promise can land in
// Firebase's default in-memory persistence for that one session (security L4).
// Exported so call sites that kick off sign-in immediately at startup can
// `await authPersistenceReady` first; existing call sites are unaffected.
export const authPersistenceReady: Promise<void> = (
  Capacitor.getPlatform() === 'web'
    // Use localStorage persistence for web browsers (including Capacitor WebView)
    ? setPersistence(auth, browserLocalPersistence)
    // Use indexedDB persistence for native platforms
    : setPersistence(auth, indexedDBLocalPersistence)
).catch((error) => {
  log.error('Failed to set auth persistence', { error }, 'firebaseConfig');
});

// Initialize analytics only if measurementId is configured. `firebase/analytics` is
// dynamically imported so it doesn't force-bundle into the eager firebase-vendor chunk.
let analytics: Analytics | undefined;
if ((config as { measurementId?: string }).measurementId) {
  import('firebase/analytics').then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  }).catch(error => {
    log.debug('Analytics failed to initialize:', error);
  });
}
export { analytics };
