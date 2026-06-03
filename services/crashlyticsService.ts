import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

// Crashlytics is native-only (Android / iOS). All methods silently no-op on web
// so callers never need platform guards themselves.
const isNative = Capacitor.isNativePlatform();

type KV = { key: string; value: string | number | boolean };
type NativeKV = { key: string; value: string | number | boolean; type: 'string' | 'long' | 'double' | 'boolean' | 'int' | 'float' };

function toNativeKV(kv: KV): NativeKV {
  let type: NativeKV['type'];
  if (typeof kv.value === 'boolean') type = 'boolean';
  else if (typeof kv.value === 'number') type = Number.isInteger(kv.value) ? 'long' : 'double';
  else type = 'string';
  return { ...kv, type };
}

/**
 * Record a non-fatal exception in Crashlytics.
 * Pass `keysAndValues` for per-call context — these are scoped to this event
 * and do NOT pollute the persistent custom-key store.
 */
const recordException = (message: string, keysAndValues?: KV[]): void => {
  if (!isNative) return;
  void FirebaseCrashlytics.recordException({
    message,
    keysAndValues: keysAndValues?.map(toNativeKV),
  }).catch(() => {
    // Never throw from crash reporter
  });
};

/**
 * Add a log breadcrumb that appears in crash reports to provide context
 * about events leading up to a crash or non-fatal.
 */
const log = (message: string): void => {
  if (!isNative) return;
  void FirebaseCrashlytics.log({ message }).catch(() => {
    // Never throw from crash reporter
  });
};

/**
 * Associate a user ID with crash reports. Call on login; pass '' on logout.
 * Never pass PII — use an opaque UID only.
 */
const setUserId = (userId: string): void => {
  if (!isNative) return;
  void FirebaseCrashlytics.setUserId({ userId }).catch(() => {
    // Never throw from crash reporter
  });
};

/**
 * Set a persistent custom key on the session.
 * Use only for stable session attributes (e.g. plan tier, platform).
 * For per-error context prefer the `keysAndValues` param on recordException.
 */
const setCustomKey = (key: string, value: string | number | boolean): void => {
  if (!isNative) return;
  void FirebaseCrashlytics.setCustomKey({ key, value, type: toNativeKV({ key, value }).type }).catch(() => {
    // Never throw from crash reporter
  });
};

const crashlyticsService = { recordException, log, setUserId, setCustomKey };
export default crashlyticsService;
