import { db } from '../firebaseConfig';
import { doc, runTransaction, onSnapshot, DocumentReference } from 'firebase/firestore';
import remoteConfig from './remoteConfigService';
import { log } from './logService';

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  /** Rich body text written by notificationService.ts */
  message?: string;
  data?: Record<string, any>;
  createdAt?: any;
  read?: boolean;
  dedupeKey?: string;
  // Rich fields present when created via notificationService.ts
  type?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionLabel?: string;
  actionType?: string;
  actionData?: any;
  snoozedUntil?: any;
  expiresAt?: any;
}

function getNotificationsDocRef(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'cache', 'notifications');
}

/**
 * Per-user in-memory write queue so concurrent callers for the same uid are
 * serialized rather than fighting each other (which produces failed-precondition
 * from Firestore's optimistic concurrency check).
 */
const _writeQueues = new Map<string, Promise<void>>();

function serializeWrite(uid: string, fn: () => Promise<void>): Promise<void> {
  const prev = _writeQueues.get(uid) ?? Promise.resolve();
  const next = prev.then(fn).catch(() => {/* errors handled inside fn */});
  _writeQueues.set(uid, next);
  // Clean up the map entry once the chain is idle
  next.finally(() => {
    if (_writeQueues.get(uid) === next) _writeQueues.delete(uid);
  });
  return next;
}

/**
 * Append a notification to the user's notifications cache document.
 * Uses a transaction to avoid races and caps the array length.
 * Calls are serialized per-uid and retried on failed-precondition (optimistic
 * concurrency conflicts that Firebase does not auto-retry).
 */
export async function appendNotificationToUser(uid: string, notification: NotificationItem, maxItems = remoteConfig.getNumber('notifications_max_stored')) {
  return serializeWrite(uid, () => _appendWithRetry(uid, notification, maxItems));
}

async function _appendWithRetry(uid: string, notification: NotificationItem, maxItems: number, attempt = 0): Promise<void> {
  const ref = getNotificationsDocRef(uid);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref as any);
      const data = snap.exists() ? (snap.data() as any) : {};
      const existing = Array.isArray(data.items) ? (data.items as NotificationItem[]) : [];
      const createdAtValue = notification && typeof notification.createdAt === 'string'
        ? notification.createdAt
        : new Date().toISOString();
      const newItem = { ...notification, createdAt: createdAtValue };

      // Prune already-expired notifications before adding the new one
      const now = new Date();
      const pruned = existing.filter(n => {
        if (!n.expiresAt) return true;
        try {
          const expiry = typeof n.expiresAt === 'string'
            ? new Date(n.expiresAt)
            : (n.expiresAt as any)?.toDate?.() ?? new Date(n.expiresAt as any);
          return expiry > now;
        } catch {
          return true;
        }
      });

      let next: NotificationItem[];
      if (newItem.dedupeKey) {
        // Replace any existing notification with the same dedupeKey, preserving array position order
        const idx = pruned.findIndex(n => n.dedupeKey === newItem.dedupeKey);
        if (idx !== -1) {
          next = [...pruned];
          next[idx] = { ...newItem, createdAt: createdAtValue };
        } else {
          next = [...pruned, newItem];
        }
      } else {
        next = [...pruned, newItem];
      }

      // Trim oldest if over cap
      const trimmed = next.slice(-maxItems);
      tx.set(ref as any, { items: trimmed }, { merge: true });
    });
  } catch (err: any) {
    // Firebase SDK only auto-retries transactions on ABORTED, not FAILED_PRECONDITION.
    // FAILED_PRECONDITION (HTTP 400) happens when our optimistic-concurrency precondition
    // fails due to a concurrent write. Retry with exponential backoff + jitter.
    const isConflict = err?.code === 'failed-precondition' || err?.code === 'aborted';
    const MAX_RETRIES = 4;
    if (isConflict && attempt < MAX_RETRIES) {
      const delay = Math.min(100 * 2 ** attempt + Math.random() * 50, 2000);
      await new Promise(r => setTimeout(r, delay));
      return _appendWithRetry(uid, notification, maxItems, attempt + 1);
    }
    // Provide contextual debug info to help troubleshoot permission errors
    log.error('appendNotificationToUser failed after retries', {
      error: err?.message || err,
      notificationId: notification?.id
    }, 'notificationsService');
    throw err;
  }
}

/**
 * Listen to a user's notifications cache document with a throttled callback.
 * Returns an unsubscribe function.
 */
export function listenToUserNotifications(uid: string, onChange: (items: NotificationItem[]) => void, throttleMs = 1000) {
  const ref = getNotificationsDocRef(uid);
  let timer: any = null;
  let lastPayload: NotificationItem[] | null = null;

  const unsub = onSnapshot(ref as any, (snapshot: any) => {
    const data = snapshot.exists() ? (snapshot.data() as any).items : [];
    lastPayload = data;
    if (throttleMs <= 0) {
      onChange(data);
      return;
    }
    if (timer) return; // already scheduled
    timer = setTimeout(() => {
      timer = null;
      if (lastPayload) onChange(lastPayload);
    }, throttleMs);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}

export default {
  appendNotificationToUser,
  listenToUserNotifications
};

export async function getNotificationsOnce(uid: string): Promise<NotificationItem[]> {
  const ref = getNotificationsDocRef(uid);
  // use a transaction read to be safe
  try {
    const result = await runTransaction(db, async (tx) => {
      const s = await tx.get(ref as any);
      const data = s.exists() ? (s.data() as any) : {};
      return Array.isArray(data.items) ? (data.items as NotificationItem[]) : [];
    });
    return result;
  } catch (_err) {
    // best-effort fallback: return empty
    return [];
  }
}

export async function markNotificationRead(uid: string, notificationId: string) {
  // Update the notification in the per-user cache
  await updateNotificationInCache(uid, notificationId, { read: true });
}

export async function deleteNotification(uid: string, notificationId: string) {
  // Delete the notification from the per-user cache
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];
    const filtered = items.filter(i => i.id !== notificationId);
    tx.set(ref as any, { items: filtered }, { merge: true });
  });
}

/**
 * Update fields of a notification in the per-user notifications cache.
 * This is a best-effort update for clients that cannot write to the
 * top-level `notifications` collection (e.g., due to security rules).
 */
export async function updateNotificationInCache(uid: string, notificationId: string, patch: Partial<NotificationItem>) {
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];
    const updated = items.map(i => i.id === notificationId ? { ...i, ...patch } : i);
    tx.set(ref as any, { items: updated }, { merge: true });
  });
}

export async function snoozeNotificationInCache(uid: string, notificationId: string, minutes: number) {
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const updated = items.map(i => i.id === notificationId ? { ...i, snoozedUntil } : i);
    tx.set(ref as any, { items: updated }, { merge: true });
  });
}

export async function markAllNotificationsRead(uid: string) {
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];
    const updated = items.map(i => ({ ...i, read: true }));
    tx.set(ref as any, { items: updated }, { merge: true });
  });
}

/**
 * Remove notifications that reference only deleted pantry items.
 * - Multi-item notifications (actionData.items[]) are removed only when ALL
 *   referenced item IDs have been deleted.
 * - Single-item notifications (actionData.itemId) are removed when that item
 *   has been deleted.
 * Notifications with no item references are left untouched.
 */
export async function pruneNotificationsForDeletedItems(uid: string, deletedItemIds: string[]): Promise<void> {
  if (!uid || deletedItemIds.length === 0) return;
  const deletedSet = new Set(deletedItemIds);
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];

    const kept = items.filter(n => {
      // Multi-item notification: actionData.items[].itemId
      if (Array.isArray(n.actionData?.items) && n.actionData.items.length > 0) {
        const referencedIds: string[] = n.actionData.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((i: any) => i.itemId)
          .filter(Boolean);
        // Keep if at least one referenced item is NOT deleted
        return referencedIds.length === 0 || !referencedIds.every(id => deletedSet.has(id));
      }
      // Single-item notification: actionData.itemId
      if (n.actionData?.itemId) {
        return !deletedSet.has(n.actionData.itemId);
      }
      return true; // no item reference — keep
    });

    if (kept.length === items.length) return; // nothing changed, skip write
    tx.set(ref as any, { items: kept }, { merge: true });
  });
}
