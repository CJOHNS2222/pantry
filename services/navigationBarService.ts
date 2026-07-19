import { Capacitor } from '@capacitor/core';
import { log } from './logService';

export class NavigationBarService {
  /**
   * Update native Android navigation bar color and icon contrast style
   */
  static async setTheme(mode: 'light' | 'dark', customBgColor?: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      const { NavigationBar, Style } = await import('@capawesome/capacitor-navigation-bar');

      // Determine background hex color
      let backgroundColor = mode === 'dark' ? '#111827' : '#ffffff';
      if (customBgColor && customBgColor.startsWith('#')) {
        backgroundColor = customBgColor;
      }

      await NavigationBar.setColor({ color: backgroundColor });
      
      // Set icon contrast style (Style.Dark = light icons on dark bg, Style.Light = dark icons on light bg)
      const style = mode === 'dark' ? Style.Dark : Style.Light;
      await NavigationBar.setStyle({ style });
    } catch (err: unknown) {
      // Non-fatal: Navigation bar plugin might not be available in browser or webview
      log.debug('Failed to set Android navigation bar style', { error: err }, 'NavigationBarService');
    }
  }

  /**
   * Hide native Android navigation bar (e.g. immersive mode)
   */
  static async hide(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const { NavigationBar } = await import('@capawesome/capacitor-navigation-bar');
      await NavigationBar.hide();
    } catch (err: unknown) {
      log.debug('Failed to hide navigation bar', { error: err }, 'NavigationBarService');
    }
  }

  /**
   * Show native Android navigation bar
   */
  static async show(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const { NavigationBar } = await import('@capawesome/capacitor-navigation-bar');
      await NavigationBar.show();
    } catch (err: unknown) {
      log.debug('Failed to show navigation bar', { error: err }, 'NavigationBarService');
    }
  }
}

export default NavigationBarService;
