import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * SafeAreaService provides safe area information for mobile devices
 * to ensure content doesn't get hidden behind notches, navigation bars, etc.
 */
class SafeAreaService {
  private insets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  private isInitialized = false;

  /**
   * Check if safe area plugin is available
   */
  private isAvailable(): boolean {
    return Capacitor.isPluginAvailable('SafeArea');
  }

  /**
   * Initialize safe area detection
   */
  async initialize(): Promise<void> {
    if (!this.isAvailable() || this.isInitialized) {
      return;
    }

    try {
      const result = await SafeArea.getSafeAreaInsets();
      this.insets = {
        top: result.insets.top,
        bottom: result.insets.bottom,
        left: result.insets.left,
        right: result.insets.right
      };
      this.isInitialized = true;

      // Apply safe area styles to the document
      this.applySafeAreaStyles();
    } catch (err: any) {
      console.warn('Safe area detection failed:', error);
      // Fallback to basic viewport handling
      this.applyFallbackSafeArea();
    }
  }

  /**
   * Get current safe area insets
   */
  getInsets(): SafeAreaInsets {
    return { ...this.insets };
  }

  /**
   * Apply safe area styles to the document root
   */
  private applySafeAreaStyles(): void {
    const root = document.documentElement;

    // Set CSS custom properties for safe area insets
    root.style.setProperty('--safe-area-inset-top', `${this.insets.top}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${this.insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${this.insets.left}px`);
    root.style.setProperty('--safe-area-inset-right', `${this.insets.right}px`);

    // Don't apply body padding - let components handle their own safe area positioning
    // This prevents double-padding issues with navigation and other fixed elements
  }

  /**
   * Fallback safe area handling for devices without the plugin
   */
  private applyFallbackSafeArea(): void {
    const root = document.documentElement;

    // Use CSS environment variables as fallback (supported in some browsers)
    root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
    root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
    root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');

    // Don't apply body padding in fallback either - let components handle safe areas
  }

  /**
   * Get safe area aware viewport height (100vh replacement)
   */
  getViewportHeight(): string {
    if (this.isInitialized) {
      const height = window.innerHeight - this.insets.top - this.insets.bottom;
      return `${height}px`;
    }
    // Fallback to 100vh with adjustments
    return 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))';
  }

  /**
   * Check if device has notches or special safe area requirements
   */
  hasNotch(): boolean {
    return this.insets.top > 20 || this.insets.bottom > 0;
  }
}

export default new SafeAreaService();
