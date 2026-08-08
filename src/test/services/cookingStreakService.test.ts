import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeStreak,
  getCookingStreak,
  seedCookingStreakFromServer,
  recordCookedToday
} from '../../../services/cookingStreakService';
import DatabaseMonitoringService from '../../../services/databaseMonitoringService';

vi.mock('firebase/firestore', () => ({
  arrayUnion: vi.fn((val) => [val])
}));

vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    doc: vi.fn().mockReturnValue('mock-user-doc-ref'),
    updateDoc: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('cookingStreakService', () => {
  const today = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, val) => {
      store[key] = String(val);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      store = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeStreak', () => {
    it('returns 0 for empty or invalid dates array', () => {
      expect(computeStreak([])).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(computeStreak(null as any)).toBe(0);
    });

    it('returns 1 if today is the only date', () => {
      expect(computeStreak([today])).toBe(1);
    });

    it('returns 1 if yesterday is the only date', () => {
      expect(computeStreak([yesterday])).toBe(1);
    });

    it('returns 0 if latest cooked date is older than yesterday', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]!;
      expect(computeStreak([threeDaysAgo])).toBe(0);
    });

    it('calculates consecutive day streak correctly', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]!;
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]!;

      expect(computeStreak([today, yesterday, twoDaysAgo, threeDaysAgo])).toBe(4);
    });

    it('stops counting streak at first gap', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0]!;

      expect(computeStreak([today, yesterday, fourDaysAgo])).toBe(2);
    });

    it('handles duplicate and unsorted dates', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]!;

      expect(computeStreak([twoDaysAgo, today, yesterday, today, twoDaysAgo])).toBe(3);
    });
  });

  describe('getCookingStreak & localStorage integration', () => {
    it('returns 0 when localStorage has no streak data', () => {
      expect(getCookingStreak()).toBe(0);
    });

    it('returns current streak stored in localStorage', () => {
      localStorage.setItem('cookingStreakDates', JSON.stringify([yesterday, today]));

      expect(getCookingStreak()).toBe(2);
    });
  });

  describe('seedCookingStreakFromServer', () => {
    it('merges server dates into local storage without duplicating', () => {
      localStorage.setItem('cookingStreakDates', JSON.stringify([yesterday]));

      seedCookingStreakFromServer([today, yesterday]);

      const stored = JSON.parse(localStorage.getItem('cookingStreakDates') || '[]');
      expect(stored).toContain(today);
      expect(stored).toContain(yesterday);
      expect(getCookingStreak()).toBe(2);
    });

    it('handles undefined or empty server dates gracefully', () => {
      seedCookingStreakFromServer(undefined);
      expect(localStorage.getItem('cookingStreakDates')).toBeFalsy();

      seedCookingStreakFromServer([]);
      expect(localStorage.getItem('cookingStreakDates')).toBeFalsy();
    });
  });

  describe('recordCookedToday', () => {
    it('records today in local storage and returns new streak', async () => {
      localStorage.setItem('cookingStreakDates', JSON.stringify([yesterday]));

      const newStreak = await recordCookedToday();
      expect(newStreak).toBe(2);

      const stored = JSON.parse(localStorage.getItem('cookingStreakDates') || '[]');
      expect(stored).toContain(today);
    });

    it('does not duplicate write or Firestore update if today is already recorded', async () => {
      localStorage.setItem('cookingStreakDates', JSON.stringify([today]));

      const streak = await recordCookedToday('user123');
      expect(streak).toBe(1);
      expect(DatabaseMonitoringService.updateDoc).not.toHaveBeenCalled();
    });

    it('syncs to Firestore when userId is provided', async () => {
      const streak = await recordCookedToday('user123');
      expect(streak).toBe(1);

      expect(DatabaseMonitoringService.doc).toHaveBeenCalledWith('users', 'user123');
      expect(DatabaseMonitoringService.updateDoc).toHaveBeenCalled();
    });
  });
});
