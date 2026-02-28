import { useEffect, useState, useRef } from 'react';
import { listenToUserNotifications, NotificationItem } from '../services/notificationsService';

export function useUserNotifications(uid?: string, throttleMs = 1000) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unsubRef = useRef<() => void | null>(null);

  useEffect(() => {
    if (!uid) return;
    // ensure any previous unsub is cleared
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    unsubRef.current = listenToUserNotifications(uid, (newItems) => {
      setItems(newItems || []);
    }, throttleMs);

    return () => {
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = null;
    };
  }, [uid, throttleMs]);

  return { items };
}

export default useUserNotifications;
