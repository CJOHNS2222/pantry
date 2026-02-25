// Comprehensive feature flag system with gradual rollout, A/B testing, and kill switches
import { UsageService } from './usageService';
import { log } from './logService';

const GEMINI_ENABLED_ENV = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ENABLE_GEMINI === 'true';

// Feature flag configuration
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100, percentage of users
  description: string;
  lastModified: Date;
  killSwitch?: boolean; // Emergency disable
  abTestVariant?: 'A' | 'B' | null; // For A/B testing
}

// Default feature flags
const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  geminiIntegration: {
    name: 'geminiIntegration',
    enabled: true,
    rolloutPercentage: 100,
    description: 'AI-powered recipe and pantry analysis',
    lastModified: new Date(),
  },
  smartRecommendations: {
    name: 'smartRecommendations',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Intelligent recipe and shopping recommendations',
    lastModified: new Date(),
  },
  offlineMode: {
    name: 'offlineMode',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Offline pantry management capabilities',
    lastModified: new Date(),
  },
  advancedAnalytics: {
    name: 'advancedAnalytics',
    enabled: true,
    rolloutPercentage: 50,
    description: 'Detailed performance and usage analytics',
    lastModified: new Date(),
  },
  mealPlanning: {
    name: 'mealPlanning',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Weekly meal planning and grocery generation',
    lastModified: new Date(),
  },
  householdSharing: {
    name: 'householdSharing',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Multi-user household pantry sharing',
    lastModified: new Date(),
  },
  barcodeScanning: {
    name: 'barcodeScanning',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Barcode scanning for quick item addition',
    lastModified: new Date(),
  },
  priceTracking: {
    name: 'priceTracking',
    enabled: true,
    rolloutPercentage: 75,
    description: 'Grocery price tracking and trends',
    lastModified: new Date(),
  },
  darkMode: {
    name: 'darkMode',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Dark theme support',
    lastModified: new Date(),
  },
  notifications: {
    name: 'notifications',
    enabled: true,
    rolloutPercentage: 100,
    description: 'Push notifications and reminders',
    lastModified: new Date(),
  }
  ,
  // New interactive tutorial feature flag (off by default for staged rollout)
  newTutorial: {
    name: 'newTutorial',
    enabled: false,
    rolloutPercentage: 0,
    description: 'Interactive first-time tutorial with task-driven steps',
    lastModified: new Date(),
  }
};

class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: Record<string, FeatureFlag> = { ...DEFAULT_FEATURE_FLAGS };
  private userCache: Map<string, Record<string, boolean>> = new Map();

  private constructor() {
    this.loadFlagsFromStorage();
  }

  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  // Load flags from localStorage (for development/admin override)
  private loadFlagsFromStorage(): void {
    try {
      const stored = localStorage.getItem('featureFlags');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.keys(parsed).forEach(key => {
          if (this.flags[key]) {
            this.flags[key] = { ...this.flags[key], ...parsed[key] };
          }
        });
        log.info('Loaded feature flags from storage', { flags: parsed }, 'FeatureFlags');
      }
    } catch (err: any) {
      log.error('Failed to load feature flags from storage', err, 'FeatureFlags');
    }
  }

  // Save flags to localStorage
  private saveFlagsToStorage(): void {
    try {
      localStorage.setItem('featureFlags', JSON.stringify(this.flags));
    } catch (err: any) {
      log.error('Failed to save feature flags to storage', err, 'FeatureFlags');
    }
  }

  // Generate consistent user hash for rollout percentage
  private getUserHash(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100; // Return 0-99
  }

  // Check if feature is enabled for user
  isEnabled(featureName: string, userId?: string): boolean {
    const flag = this.flags[featureName];
    if (!flag) {
      log.warn(`Feature flag not found: ${featureName}`, { availableFlags: Object.keys(this.flags) }, 'FeatureFlags');
      return false;
    }

    // Check kill switch first
    if (flag.killSwitch) {
      log.info(`Feature ${featureName} disabled by kill switch`, {}, 'FeatureFlags');
      return false;
    }

    // If not enabled globally, return false
    if (!flag.enabled) {
      return false;
    }

    // If no user ID, use global setting
    if (!userId) {
      return flag.enabled;
    }

    // Check rollout percentage
    const userHash = this.getUserHash(userId);
    const isInRollout = userHash < flag.rolloutPercentage;

    log.debug(`Feature ${featureName} check for user ${userId}`, {
      userHash,
      rolloutPercentage: flag.rolloutPercentage,
      isInRollout
    }, 'FeatureFlags');

    return isInRollout;
  }

  // Get A/B test variant for user
  getABTestVariant(featureName: string, userId?: string): 'A' | 'B' | null {
    const flag = this.flags[featureName];
    if (!flag || !flag.abTestVariant) {
      return null;
    }

    if (!userId) {
      return flag.abTestVariant;
    }

    // Simple A/B split based on user hash
    const userHash = this.getUserHash(userId);
    return userHash % 2 === 0 ? 'A' : 'B';
  }

  // Admin functions to modify flags
  updateFlag(featureName: string, updates: Partial<FeatureFlag>): void {
    if (!this.flags[featureName]) {
      log.error(`Cannot update unknown feature flag: ${featureName}`, {}, 'FeatureFlags');
      return;
    }

    this.flags[featureName] = {
      ...this.flags[featureName],
      ...updates,
      lastModified: new Date()
    };

    this.saveFlagsToStorage();
    this.userCache.clear(); // Clear cache when flags change

    log.info(`Updated feature flag: ${featureName}`, { updates }, 'FeatureFlags');
  }

  // Emergency kill switch
  killSwitch(featureName: string, enabled: boolean = true): void {
    this.updateFlag(featureName, { killSwitch: enabled });
    log.warn(`Kill switch ${enabled ? 'activated' : 'deactivated'} for ${featureName}`, {}, 'FeatureFlags');
  }

  // Gradual rollout control
  setRolloutPercentage(featureName: string, percentage: number): void {
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    this.updateFlag(featureName, { rolloutPercentage: clampedPercentage });
  }

  // Get all flags (for admin interface)
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
    this.saveFlagsToStorage();
    this.userCache.clear();
    log.info('Reset all feature flags to defaults', {}, 'FeatureFlags');
  }

  // Batch update multiple flags
  updateMultipleFlags(updates: Record<string, Partial<FeatureFlag>>): void {
    Object.entries(updates).forEach(([featureName, update]) => {
      if (this.flags[featureName]) {
        this.flags[featureName] = {
          ...this.flags[featureName],
          ...update,
          lastModified: new Date()
        };
      }
    });

    this.saveFlagsToStorage();
    this.userCache.clear();

    log.info('Batch updated feature flags', { updates }, 'FeatureFlags');
  }
}

// Create singleton instance
const featureFlagService = FeatureFlagService.getInstance();

// Legacy functions for backward compatibility
export function isGeminiGloballyEnabled(): boolean {
  return featureFlagService.isEnabled('geminiIntegration');
}

export function userOptedInToGemini(userId?: string): boolean {
  try {
    const key = userId ? `gemini_opt_in_${userId}` : `gemini_opt_in_global`;
    const raw = localStorage.getItem(key);
    if (raw === null) return false;
    return raw === 'true';
  } catch (e) {
    return false;
  }
}

export function setUserGeminiOptIn(userId: string | undefined, value: boolean) {
  try {
    const key = userId ? `gemini_opt_in_${userId}` : `gemini_opt_in_global`;
    localStorage.setItem(key, value ? 'true' : 'false');
  } catch (e) {
    // ignore
  }
}

export function getGeminiUsage(userId?: string): number {
  // Deprecated: Usage tracking moved to Firebase
  return 0;
}

export function incrementGeminiUsage(userId: string | undefined, inc = 1) {
  // Deprecated: Usage tracking moved to Firebase
  return 0;
}

export function canUseGemini(userId?: string): boolean {
  // Check both global feature flag and user opt-in
  return featureFlagService.isEnabled('geminiIntegration', userId) && userOptedInToGemini(userId);
}

// New comprehensive API
export const featureFlags = {
  isEnabled: (feature: string, userId?: string) => featureFlagService.isEnabled(feature, userId),
  getABTestVariant: (feature: string, userId?: string) => featureFlagService.getABTestVariant(feature, userId),
  updateFlag: (feature: string, updates: Partial<FeatureFlag>) => featureFlagService.updateFlag(feature, updates),
  killSwitch: (feature: string, enabled?: boolean) => featureFlagService.killSwitch(feature, enabled),
  setRolloutPercentage: (feature: string, percentage: number) => featureFlagService.setRolloutPercentage(feature, percentage),
  getAllFlags: () => featureFlagService.getAllFlags(),
  resetToDefaults: () => featureFlagService.resetToDefaults(),
  updateMultipleFlags: (updates: Record<string, Partial<FeatureFlag>>) => featureFlagService.updateMultipleFlags(updates)
};

export default {
  isGeminiGloballyEnabled,
  userOptedInToGemini,
  setUserGeminiOptIn,
  getGeminiUsage,
  incrementGeminiUsage,
  canUseGemini,
  ...featureFlags
};
