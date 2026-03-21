import { db } from '../firebaseConfig';
import { doc, runTransaction, serverTimestamp, onSnapshot, DocumentReference, updateDoc, deleteDoc } from 'firebase/firestore';

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
  // Update the notification in the top-level notifications collection
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, { read: true });
}

export async function deleteNotification(uid: string, notificationId: string) {
  // Delete the notification from the top-level notifications collection
  const notificationRef = doc(db, 'notifications', notificationId);
  await deleteDoc(notificationRef);
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
