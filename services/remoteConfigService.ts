/**
 * Firebase Remote Config service.
 *
 * Provides a thin wrapper around Firebase Remote Config so the rest of the
 * app can read runtime-configurable values without knowing about the SDK.
 *
 * In-app defaults mirror the current hardcoded values in featureFlags.ts and
 * usageService.ts — they are used on first launch and whenever the network
 * fetch fails, so the app is never broken by a Remote Config outage.
 *
 * Usage:
 *   import remoteConfig from './remoteConfigService';
 *   await remoteConfig.init();            // call once at boot
 *   remoteConfig.getBoolean('flag_geminiIntegration_enabled')  // → boolean
 *   remoteConfig.getNumber('limit_free_searches_weekly')       // → number
 *   remoteConfig.getString('someString')                       // → string
 */

import { getApp } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  type RemoteConfig,
} from 'firebase/remote-config';
import { log } from './logService';

// ─── In-app defaults ─────────────────────────────────────────────────────────
// These mirror every hardcoded value Remote Config can override. The app is
// never broken by a fetch failure — these are always the safe fallback.
const IN_APP_DEFAULTS: Record<string, string | number | boolean> = {
  // ── Feature flags — enabled ───────────────────────────────────────────────
  flag_geminiIntegration_enabled: true,
  flag_smartRecommendations_enabled: true,
  flag_offlineMode_enabled: true,
  flag_advancedAnalytics_enabled: true,
  flag_mealPlanning_enabled: true,
  flag_householdSharing_enabled: true,
  flag_barcodeScanning_enabled: true,
  flag_priceTracking_enabled: true,
  flag_darkMode_enabled: true,
  flag_notifications_enabled: true,
  flag_newTutorial_enabled: true,

  // ── Feature flags — rollout percentage (0–100) ───────────────────────────
  flag_geminiIntegration_rollout: 100,
  flag_smartRecommendations_rollout: 100,
  flag_offlineMode_rollout: 100,
  flag_advancedAnalytics_rollout: 50,
  flag_mealPlanning_rollout: 100,
  flag_householdSharing_rollout: 100,
  flag_barcodeScanning_rollout: 100,
  flag_priceTracking_rollout: 75,
  flag_darkMode_rollout: 100,
  flag_notifications_rollout: 100,
  flag_newTutorial_rollout: 100,

  // ── Kill switches (true = feature killed; set false to restore normally) ──
  kill_geminiIntegration: false,
  kill_smartRecommendations: false,
  kill_offlineMode: false,
  kill_advancedAnalytics: false,
  kill_mealPlanning: false,
  kill_householdSharing: false,
  kill_barcodeScanning: false,
  kill_priceTracking: false,
  kill_darkMode: false,
  kill_notifications: false,
  kill_newTutorial: false,
  kill_receiptScanning: false,
  kill_ads: false,

  // ── Plan limits — free tier ───────────────────────────────────────────────
  limit_free_searches_weekly: 5,
  limit_free_recipes_max: 2,
  limit_free_mealplanning_weekly: 1,
  limit_free_gemini_weekly: 5,

  // ── Plan limits — premium tier ────────────────────────────────────────────
  limit_premium_searches_weekly: 15,
  limit_premium_recipes_max: 20,
  limit_premium_mealplanning_weekly: -1,
  limit_premium_gemini_weekly: 15,

  // ── Plan limits — family tier (default unlimited = -1) ───────────────────
  limit_family_searches_weekly: -1,
  limit_family_recipes_max: -1,
  limit_family_mealplanning_weekly: -1,
  limit_family_gemini_weekly: -1,

  // ── Expiry alert thresholds (days) ────────────────────────────────────────
  expiry_critical_days: 1,           // 0–1 day  → red badge
  expiry_warning_days: 3,            // 2–3 days → orange badge
  expiry_info_days: 7,               // 4–7 days → yellow badge
  expiry_frozen_alert_days: 30,      // frozen items: alert window
  expiry_recipe_suggestion_days: 7,  // suggest recipes for items expiring within N days

  // ── App behaviour ─────────────────────────────────────────────────────────
  app_review_min_days_between_prompts: 60, // days between App Store review prompts
  notifications_max_stored: 200,           // max notifications stored per user
  search_history_max_items: 20,            // max saved search history entries
  undo_max_actions: 20,                    // max undoable actions in IndexedDB
  ads_enabled: true,                       // master switch for AdMob banner ads

  // ── Maintenance / in-app announcements ───────────────────────────────────
  maintenance_mode: false,       // true = show maintenance banner, block writes
  maintenance_message: '',       // user-facing maintenance message text
  announcement_enabled: false,   // true = show in-app announcement banner
  announcement_message: '',      // announcement banner text
  announcement_type: 'info',     // 'info' | 'warning' | 'error'

  // ── Gemini AI ─────────────────────────────────────────────────────────────
  gemini_model: 'gemini-2.5-flash',        // text / analysis requests
  gemini_model_vision: 'gemini-2.5-flash', // image / vision scan tasks

  // ── App version ───────────────────────────────────────────────────────────
  min_app_version: '1.0.0',  // minimum supported version (semver); older builds get update prompt
};

// How long (seconds) to cache fetched values before re-fetching.
// 1 hour in production; use a short value in dev if you add a DEV override.
const FETCH_INTERVAL_SECONDS = 3600;

// ─── Service ─────────────────────────────────────────────────────────────────

class RemoteConfigService {
  private rc: RemoteConfig | null = null;
  private ready = false;

  /**
   * Initialise Remote Config and fetch+activate the latest values.
   * Safe to call multiple times — subsequent calls are no-ops once ready.
   * Should be called once near app boot, before reading any values.
   */
  async init(): Promise<void> {
    if (this.ready) return;

    try {
      const app = getApp();
      this.rc = getRemoteConfig(app);
      this.rc.settings.minimumFetchIntervalMillis = FETCH_INTERVAL_SECONDS * 1000;
      this.rc.defaultConfig = IN_APP_DEFAULTS as Record<string, string>;

      await fetchAndActivate(this.rc);
      this.ready = true;
      log.info('[RemoteConfig] Fetched and activated', {}, 'RemoteConfig');
    } catch (err: unknown) {
      // Non-fatal: fall back to in-app defaults
      log.warn('[RemoteConfig] Fetch failed, using in-app defaults', {
        message: err instanceof Error ? err.message : String(err),
      }, 'RemoteConfig');
      this.ready = true; // still mark ready so getters use defaults
    }
  }

  // ─── Typed getters ─────────────────────────────────────────────────────────

  getBoolean(key: string): boolean {
    if (!this.rc) return Boolean(IN_APP_DEFAULTS[key] ?? false);
    return getValue(this.rc, key).asBoolean();
  }

  getNumber(key: string): number {
    if (!this.rc) return Number(IN_APP_DEFAULTS[key] ?? 0);
    return getValue(this.rc, key).asNumber();
  }

  getString(key: string): string {
    if (!this.rc) return String(IN_APP_DEFAULTS[key] ?? '');
    return getValue(this.rc, key).asString();
  }

  // ─── Convenience helpers ───────────────────────────────────────────────────

  /** Returns true if a feature's enabled flag is on AND it isn't kill-switched. */
  isFeatureEnabled(flagName: string): boolean {
    const enabled = this.getBoolean(`flag_${flagName}_enabled`);
    const killed = this.getBoolean(`kill_${flagName}`);
    return enabled && !killed;
  }

  getRolloutPercentage(flagName: string): number {
    return this.getNumber(`flag_${flagName}_rollout`);
  }

  /** Plan limits keyed like 'free_searches_weekly', 'premium_recipes_max', etc. */
  getPlanLimit(tier: 'free' | 'premium' | 'family', limitKey: string): number {
    return this.getNumber(`limit_${tier}_${limitKey}`);
  }

  /** Expiry alert day thresholds used across UI and alert generation. */
  getExpiryThresholds(): {
    critical: number;
    warning: number;
    info: number;
    frozenAlert: number;
    recipeSuggestion: number;
  } {
    return {
      critical: this.getNumber('expiry_critical_days'),
      warning: this.getNumber('expiry_warning_days'),
      info: this.getNumber('expiry_info_days'),
      frozenAlert: this.getNumber('expiry_frozen_alert_days'),
      recipeSuggestion: this.getNumber('expiry_recipe_suggestion_days'),
    };
  }

  /** Maintenance mode status and message. */
  getMaintenanceInfo(): { active: boolean; message: string } {
    return {
      active: this.getBoolean('maintenance_mode'),
      message: this.getString('maintenance_message'),
    };
  }

  /** In-app announcement banner config. */
  getAnnouncementInfo(): { enabled: boolean; message: string; type: string } {
    return {
      enabled: this.getBoolean('announcement_enabled'),
      message: this.getString('announcement_message'),
      type: this.getString('announcement_type'),
    };
  }

  /** Return all resolved Remote Config values for admin diagnostics. */
  getDebugSnapshot(): Record<string, string | number | boolean> {
    return Object.fromEntries(
      Object.entries(IN_APP_DEFAULTS).map(([key, defaultValue]) => {
        if (typeof defaultValue === 'boolean') {
          return [key, this.getBoolean(key)];
        }

        if (typeof defaultValue === 'number') {
          return [key, this.getNumber(key)];
        }

        return [key, this.getString(key)];
      })
    );
  }
}

const remoteConfig = new RemoteConfigService();
export default remoteConfig;
