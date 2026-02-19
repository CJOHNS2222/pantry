import { impact, notification, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Haptic feedback service for mobile devices
class HapticService {
  // Check if haptics are available
  static async isAvailable(): Promise<boolean> {
    try {
      await impact({ style: ImpactStyle.Light });
      return true;
    } catch {
      return false;
    }
  }

  // Light impact for general interactions
  static async light() {
    try {
      await impact({ style: ImpactStyle.Light });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Medium impact for important actions
  static async medium() {
    try {
      await impact({ style: ImpactStyle.Medium });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Heavy impact for significant actions
  static async heavy() {
    try {
      await impact({ style: ImpactStyle.Heavy });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Success notification
  static async success() {
    try {
      await notification({ type: NotificationType.Success });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Warning notification
  static async warning() {
    try {
      await notification({ type: NotificationType.Warning });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Error notification
  static async error() {
    try {
      await notification({ type: NotificationType.Error });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }
}

export default HapticService;
