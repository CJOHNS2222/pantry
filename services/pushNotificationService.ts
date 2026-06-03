import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { log } from './logService';

class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Waits until the app is in the foreground (isActive: true) before resolving.
   * This prevents a NullPointerException in Bridge.getPermissionStates on Android
   * cold starts where getActivity() can return null during early initialization.
   */
  private async waitForAppActive(): Promise<void> {
    try {
      const { isActive } = await CapApp.getState();
      if (!isActive) {
        await new Promise<void>((resolve) => {
          const listenerPromise = CapApp.addListener('appStateChange', ({ isActive: active }) => {
            if (active) {
              listenerPromise.then(l => l.remove());
              resolve();
            }
          });
        });
      }
      // Brief delay to ensure Bridge internals are ready after the app appears active.
      await new Promise<void>(r => setTimeout(r, 300));
    } catch {
      // App plugin unavailable (e.g. web); proceed anyway
    }
  }

  /**
   * Requests push notification permissions with retry logic.
   * On Android (especially API 36+ / Capacitor 8), the native Bridge can throw a
   * NullPointerException in Bridge.getPermissionStates() during cold start because
   * the PluginHandle's annotation field is not yet visible on the CapacitorPlugins
   * handler thread. Retrying after a short delay gives the JMM time to propagate
   * the field write.
   */
  private async requestPermissionsWithRetry(maxAttempts = 3): Promise<{ receive: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await PushNotifications.requestPermissions();
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        // Exponential back-off: 500ms, 1000ms
        await new Promise<void>(r => setTimeout(r, attempt * 500));
      }
    }
    // Unreachable, but satisfies TypeScript
    throw new Error('requestPermissions failed after retries');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // Ensure the app is foregrounded before requesting permissions.
      // Calling requestPermissions() before Bridge.getActivity() is set causes a
      // fatal NullPointerException on the CapacitorPlugins thread during cold start.
      await this.waitForAppActive();

      // Request permission with retry to survive transient Bridge NPE on cold start.
      const permission = await this.requestPermissionsWithRetry();
      if (permission.receive !== 'granted') {
        // Push notification permissions not granted
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Set up listeners
      this.setupListeners();

      this.isInitialized = true;
      // Push notifications initialized successfully
    } catch (err: unknown) {
      log.error('Failed to initialize push notifications', err);
    }
  }

  private setupListeners(): void {
    // When registration succeeds
    PushNotifications.addListener('registration', (token) => {
      // Push notification registration successful
      this.fcmToken = token.value;
      // Store token for server-side sending
      this.storeToken(token.value);
    });

    // When registration fails
    PushNotifications.addListener('registrationError', (error) => {
      log.error('Push notification registration failed', { error });
    });

    // When a notification is received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Push notification received
      // Handle foreground notification (could show in-app notification)
      this.handleForegroundNotification(notification);
    });

    // When a notification action is performed
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // Push notification action performed
      this.handleNotificationAction(action);
    });
  }

  private async storeToken(token: string): Promise<void> {
    try {
      // Store token in localStorage for now (in production, send to your server)
      localStorage.setItem('fcmToken', token);
      // FCM token stored
    } catch (err: unknown) {
      log.error('Failed to store FCM token', { err });
    }
  }

  private handleForegroundNotification(_notification: PushNotificationSchema): void {
    // When app is in foreground, show in-app notification instead of system notification
    // This prevents duplicate notifications
    // Handling foreground notification

    // You could dispatch to your existing notification system here
    // For example, create an in-app notification banner
  }

  private handleNotificationAction(action: ActionPerformed): void {
    // Handle user tapping on notification or action buttons
    // Handling notification action

    const { notification, actionId } = action;

    // Navigate to relevant part of app based on notification type
    if (actionId === 'tap') {
      // User tapped the notification
      this.handleNotificationTap(notification);
    } else if (actionId === 'shopping') {
      // Custom action for shopping list
      this.navigateToShoppingList();
    } else if (actionId === 'pantry') {
      // Custom action for pantry
      this.navigateToPantry();
    } else if (actionId === 'daily_check') {
      // Daily combined notification
      this.handleDailyCheck(notification);
    }
  }

  private handleNotificationTap(notification: PushNotificationSchema): void {
    // Navigate based on notification data
    const data = notification.data;
    if (data?.type === 'expiration') {
      // Navigate to pantry with expired item highlighted
      this.navigateToPantry(data.itemId);
    } else if (data?.type === 'shopping') {
      // Navigate to shopping list
      this.navigateToShoppingList();
    } else if (data?.type === 'system' && data?.tab) {
      // Daily combined notification
      this.handleDailyCheck(notification);
    }
  }

  private navigateToPantry(_itemId?: string): void {
    // Use your app's navigation system
    // For example: router.push('/pantry' + (itemId ? `?highlight=${itemId}` : ''));
    // Navigate to pantry, highlight item
  }

  private navigateToShoppingList(): void {
    // Use your app's navigation system
    // For example: router.push('/shopping');
    // Navigate to shopping list
  }

  private handleDailyCheck(notification: PushNotificationSchema): void {
    // This is called when user taps the local notification
    // We need to navigate, but the actual push notification with data
    // should have been sent separately by the NotificationService
    const data = notification.data;
    if (data?.tab === 'meals') {
      // Navigate to meal planner
      this.navigateToMeals();
    } else if (data?.tab === 'shopping') {
      // Navigate to shopping list
      this.navigateToShoppingList();
    } else {
      // Default to meal planner if both are present, shopping if only shopping
      this.navigateToMeals();
    }
  }

  private navigateToMeals(): void {
    // Use your app's navigation system
    // For example: router.push('/meals');
    // Navigate to meal planner
  }

  // Method to send test push notification (for development)
  async sendTestNotification(): Promise<void> {
    if (!this.fcmToken) {
      log.error('No FCM token available');
      return;
    }

    // In production, this would be done server-side
    // For testing, you could use Firebase Admin SDK or REST API
    // Test notification would be sent
  }

  // Get current FCM token
  getToken(): string | null {
    return this.fcmToken || localStorage.getItem('fcmToken');
  }

  // Check if push notifications are supported
  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  // Unregister from push notifications
  async unregister(): Promise<void> {
    try {
      await PushNotifications.unregister();
      localStorage.removeItem('fcmToken');
      this.fcmToken = null;
      this.isInitialized = false;
      // Push notifications unregistered
    } catch (err: unknown) {
      log.error('Failed to unregister push notifications', { err });
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
