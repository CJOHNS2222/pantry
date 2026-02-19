import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { messaging } from '../firebaseConfig';
import { getToken, onMessage } from 'firebase/messaging';

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

  async initialize(): Promise<void> {
    if (this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // Request permission for push notifications
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        console.log('Push notification permissions not granted');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Set up listeners
      this.setupListeners();

      this.isInitialized = true;
      console.log('Push notifications initialized successfully');
    } catch (err: any) {
      console.error('Failed to initialize push notifications:', err);
    }
  }

  private setupListeners(): void {
    // When registration succeeds
    PushNotifications.addListener('registration', (token) => {
      console.log('Push notification registration successful, token:', token.value);
      this.fcmToken = token.value;
      // Store token for server-side sending
      this.storeToken(token.value);
    });

    // When registration fails
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push notification registration failed:', error);
    });

    // When a notification is received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      // Handle foreground notification (could show in-app notification)
      this.handleForegroundNotification(notification);
    });

    // When a notification action is performed
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action performed:', action);
      this.handleNotificationAction(action);
    });
  }

  private async storeToken(token: string): Promise<void> {
    try {
      // Store token in localStorage for now (in production, send to your server)
      localStorage.setItem('fcmToken', token);
      console.log('FCM token stored:', token);
    } catch (err: any) {
      console.error('Failed to store FCM token:', err);
    }
  }

  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // When app is in foreground, show in-app notification instead of system notification
    // This prevents duplicate notifications
    console.log('Handling foreground notification:', notification);

    // You could dispatch to your existing notification system here
    // For example, create an in-app notification banner
  }

  private handleNotificationAction(action: ActionPerformed): void {
    // Handle user tapping on notification or action buttons
    console.log('Handling notification action:', action);

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

  private navigateToPantry(itemId?: string): void {
    // Use your app's navigation system
    // For example: router.push('/pantry' + (itemId ? `?highlight=${itemId}` : ''));
    console.log('Navigate to pantry, highlight item:', itemId);
  }

  private navigateToShoppingList(): void {
    // Use your app's navigation system
    // For example: router.push('/shopping');
    console.log('Navigate to shopping list');
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
    console.log('Navigate to meal planner');
  }

  // Method to send test push notification (for development)
  async sendTestNotification(): Promise<void> {
    if (!this.fcmToken) {
      console.error('No FCM token available');
      return;
    }

    // In production, this would be done server-side
    // For testing, you could use Firebase Admin SDK or REST API
    console.log('Test notification would be sent to token:', this.fcmToken);
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
      console.log('Push notifications unregistered');
    } catch (err: any) {
      console.error('Failed to unregister push notifications:', err);
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
