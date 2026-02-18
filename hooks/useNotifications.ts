import { useState, useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { DayPlan } from '../types';

interface NotificationSettings {
  enabled: boolean;
  time: string;
  types: {
    shoppingList: boolean;
    mealPlan: boolean;
  };
}

export function useNotifications(settings: NotificationSettings, userEmail?: string, mealPlan?: DayPlan[]): any {
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Skip notification setup on web
      return;
    }

    const checkPermissions = async () => {
      try {
        const permission = await LocalNotifications.checkPermissions();
        setNotificationPermission(permission.display);
      } catch (err: any) {
        console.error('Error checking notification permissions:', error);
      }
    };

    checkPermissions();

    const setupNotifications = async () => {
      try {
        // Request permissions
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== 'granted') {
          console.log('Notification permissions not granted');
          return;
        }

        // Cancel existing notifications
        await LocalNotifications.cancel({ notifications: [] });

        if (settings.enabled && userEmail) {
          await scheduleNotifications(settings, mealPlan);
        }
      } catch (err: any) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();
  }, [settings.enabled, settings.time, settings.types, userEmail, mealPlan]);

  const requestNotificationPermission = async () => {
    try {
      const permission = await LocalNotifications.requestPermissions();
      setNotificationPermission(permission.display);
      return permission.display;
    } catch (err: any) {
      console.error('Error requesting notification permissions:', error);
      return 'denied';
    }
  };

  const scheduleNotifications = async (settings: NotificationSettings, mealPlan?: DayPlan[]) => {
    const [hours, minutes] = settings.time.split(':').map(Number);
    const now = new Date();
    const notificationTime = new Date(now);
    notificationTime.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (notificationTime <= now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    if (Capacitor.isNativePlatform()) {
      const notifications = [];

      // Single daily combined notification (meals + shopping)
      if (settings.types.shoppingList || settings.types.mealPlan) {
        notifications.push({
          id: 1,
          title: 'Daily Pantry Check',
          body: 'Check your meals to prepare and shopping list for today',
          schedule: {
            at: notificationTime,
            repeats: true,
            every: 'day'
          },
          actionTypeId: 'daily_check',
          extra: { type: 'dailyCombined' }
        });
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
    }
  };

  // On web (non-native) platforms we intentionally return an empty object
  // so callers can detect native-capable environments. Tests rely on
  // this behavior to avoid needing native plugins in the test runner.
  if (!Capacitor.isNativePlatform()) return {} as any;

  return {
    notificationPermission,
    requestNotificationPermission
  };
}
