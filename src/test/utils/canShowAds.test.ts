import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Capacitor before importing appUtils
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'android'),
    isNativePlatform: vi.fn(() => true),
  },
}));

// Mock remoteConfigService
vi.mock('../../../services/remoteConfigService', () => ({
  default: {
    getBoolean: vi.fn((key: string) => {
      if (key === 'ads_enabled') return true;
      if (key === 'kill_ads') return false;
      return false;
    }),
  },
}));

// Mock UsageService
vi.mock('../../../services/usageService', () => ({
  UsageService: {
    getUsageLimits: vi.fn(),
  },
}));

import { canShowAds } from '../../../utils/appUtils';
import { UsageService } from '../../../services/usageService';
import { Capacitor } from '@capacitor/core';

const freeLimits = {
  resolvedTier: 'free' as const,
  searches: { weekly: 5, used: 2, resetDate: new Date() },
  recipes: { max: 2, used: 1 },
  mealPlanning: { weeklyRecipes: 1, weeklyUsed: 0, twoWeekPlanning: false, resetDate: new Date() },
  gemini: { weekly: 5, used: 0, resetDate: new Date() },
};

const premiumLimits = {
  ...freeLimits,
  resolvedTier: 'premium' as const,
};

const familyLimits = {
  ...freeLimits,
  resolvedTier: 'family' as const,
};

const freeUser: any = {
  id: 'user1',
  subscription: { tier: 'free' },
};

describe('canShowAds', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(freeLimits);
  });

  it('returns true for free user on native platform within limits', async () => {
    const result = await canShowAds(freeUser);
    expect(result).toBe(true);
  });

  it('returns false when user is null', async () => {
    expect(await canShowAds(null)).toBe(false);
  });

  it('returns false on web platform', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
    expect(await canShowAds(freeUser)).toBe(false);
  });

  it('returns false for premium user (own tier)', async () => {
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(premiumLimits);
    expect(await canShowAds(freeUser)).toBe(false);
  });

  it('returns false for household-elevated member (resolvedTier = family)', async () => {
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(familyLimits);
    expect(await canShowAds(freeUser)).toBe(false);
  });

  it('returns false when all usage limits are at max (no remaining usage)', async () => {
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue({
      ...freeLimits,
      recipes: { max: 2, used: 2 },
      mealPlanning: { ...freeLimits.mealPlanning, weeklyUsed: 1, weeklyRecipes: 1 },
      searches: { weekly: 5, used: 5, resetDate: new Date() },
    });
    // All limits hit — canShowAds should return false (user has no features left to gate)
    expect(await canShowAds(freeUser)).toBe(false);
  });
});
