import { db } from '../firebaseConfig';
import { doc, runTransaction, serverTimestamp, onSnapshot, DocumentReference } from 'firebase/firestore';

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  createdAt?: any;
  read?: boolean;
}

const DEFAULT_MAX_NOTIFICATIONS = 200;

function getNotificationsDocRef(uid: string): DocumentReference {
  return doc(db, 'users', uid, 'cache', 'notifications');
}

/**
 * Append a notification to the user's notifications cache document.
 * Uses a transaction to avoid races and caps the array length.
 */
export async function appendNotificationToUser(uid: string, notification: NotificationItem, maxItems = DEFAULT_MAX_NOTIFICATIONS) {
  const ref = getNotificationsDocRef(uid);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref as any);
      const data = snap.exists() ? (snap.data() as any) : {};
      const existing = Array.isArray(data.items) ? (data.items as NotificationItem[]) : [];
      // Firestore does not support serverTimestamp() inside arrays.
      // Use a client timestamp (ISO string) for items stored in arrays.
      const createdAtValue = notification && typeof notification.createdAt === 'string'
        ? notification.createdAt
        : new Date().toISOString();
      const next = [...existing, { ...notification, createdAt: createdAtValue }];
      // Trim oldest if over cap
      const trimmed = next.slice(-maxItems);
      tx.set(ref as any, { items: trimmed }, { merge: true });
    });
  } catch (err: any) {
    // Provide contextual debug info to help troubleshoot permission errors
    console.error('appendNotificationToUser failed', {
      error: err?.message || err,
      targetUid: uid,
      notification
    });
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
  } catch (err) {
    // best-effort fallback: return empty
    return [];
  }
}

export async function markNotificationRead(uid: string, notificationId: string) {
  const ref = getNotificationsDocRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const items = Array.isArray(data.items) ? data.items as NotificationItem[] : [];
    const updated = items.map(i => i.id === notificationId ? { ...i, read: true } : i);
    tx.set(ref as any, { items: updated }, { merge: true });
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
