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
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Medium impact for important actions
  static async medium() {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Heavy impact for significant actions
  static async heavy() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Success notification
  static async success() {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Warning notification
  static async warning() {
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Error notification
  static async error() {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Custom vibration pattern
  static async vibrate(duration: number = 100) {
    try {
      await Haptics.vibrate({ duration });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Selection feedback (like picker wheel)
  static async selection() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Button press feedback
  static async buttonPress() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Item added feedback
  static async itemAdded() {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Item removed feedback
  static async itemRemoved() {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Tab switch feedback
  static async tabSwitch() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Success action feedback (like completing a task)
  static async actionSuccess() {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }

  // Error action feedback
  static async actionError() {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (err: any) {
      // Silently fail if haptics not available
    }
  }
}

export default HapticService;
