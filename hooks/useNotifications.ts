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

export function useNotifications(settings: NotificationSettings, userEmail?: string, mealPlan?: DayPlan[]) {
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
      } catch (error) {
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
      } catch (error) {
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
    } catch (error) {
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

      if (settings.types.shoppingList) {
        notifications.push({
          id: 1,
          title: 'Shopping List Reminder',
          body: 'Don\'t forget to check your shopping list!',
          schedule: {
            at: notificationTime,
            repeats: true,
            every: 'day'
          },
          actionTypeId: 'shopping',
          extra: { type: 'shoppingList' }
        });
      }

      if (settings.types.mealPlan) {
        // Schedule meal preparation notifications for each planned meal
        if (mealPlan) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const todayPlan = mealPlan.find(day => day.date === today);
          const todaysMeals = [
            ...(todayPlan?.breakfast || []),
            ...(todayPlan?.lunch || []),
            ...(todayPlan?.dinner || [])
          ];
          
          // Assume meal times: 0=breakfast(8am), 1=lunch(12pm), 2=dinner(6pm)
          const mealTimes = [8, 12, 18]; // hours
          
          todaysMeals.forEach((meal, index) => {
            if (index < mealTimes.length) {
              const mealTime = new Date();
              mealTime.setHours(mealTimes[index], 0, 0, 0);
              const prepTime = new Date(mealTime);
              prepTime.setHours(prepTime.getHours() - 2); // 2 hours before

              if (prepTime > now) {
                const mealNames = ['Breakfast', 'Lunch', 'Dinner'];
                notifications.push({
                  id: 3 + index, // 3, 4, 5
                  title: `${mealNames[index]} Preparation Reminder`,
                  body: `Time to prepare your ${mealNames[index].toLowerCase()}!`,
                  schedule: {
                    at: prepTime,
                    repeats: false // Only for today
                  },
                  actionTypeId: 'mealprep',
                  extra: { type: 'mealPrep', mealIndex: index }
                });
              }
            }
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
      }
    }
  };

  return {
    notificationPermission,
    requestNotificationPermission
  };
}