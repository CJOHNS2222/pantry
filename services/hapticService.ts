import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Haptic feedback service for mobile devices
class HapticService {
  // Check if haptics are available
  static async isAvailable(): Promise<boolean> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      return true;
    } catch {
      return false;
    }
  }

  // Light impact for general interactions
  static async light() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Silently fail if haptics not available
    }
  }

  // Medium impact for important actions
  static async medium() {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Silently fail if haptics not available
    }
  }

  // Heavy impact for significant actions
  static async heavy() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Silently fail if haptics not available
    }
  }

  // Success notification
  static async success() {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // Silently fail if haptics not available
    }
  }

  // Warning notification
  static async warning() {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {
      // Silently fail if haptics not available
    }
  }

  // Error notification
  static async error() {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Silently fail if haptics not available
    }
  }

  static async itemAdded() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Silently fail if haptics not available
    }
  }
}

export default HapticService;
