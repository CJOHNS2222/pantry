import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';

/**
 * Global pantry-score leaderboard cache. Every opted-in user's entry, and every
 * opted-in household's entry, lives as one key inside a single shared document
 * (`leaderboard_cache/global`) instead of one document per user/household, so:
 * - loading the leaderboard is 1 read (the whole doc: both maps), not N reads
 * - logging your own (or your household's) score is 1 targeted field write
 *   (`entries.{uid}` / `householdEntries.{householdId}`), not a read-modify-write
 *   of the whole list
 * Mirrors the pattern used by `price_cache/priceData` and the other `*CacheService`s.
 */

export const CACHE_VERSION = '1.0';

const CACHE_PATH = 'leaderboard_cache/global';

export interface GlobalLeaderboardEntry {
  name: string;
  score: number;
  streak: number;
  badges: number;
  isHousehold: boolean;
  isAnonymous: boolean;
  updatedAt: string;
}

export interface GlobalHouseholdLeaderboardEntry {
  name: string;
  score: number;
  streak: number;
  badges: number;
  memberCount: number;
  updatedAt: string;
}

export type GlobalLeaderboardEntries = { [userId: string]: GlobalLeaderboardEntry };
export type GlobalHouseholdLeaderboardEntries = { [householdId: string]: GlobalHouseholdLeaderboardEntry };

const getCacheRef = () => DatabaseMonitoringService.doc(CACHE_PATH);

// 1 read: fetch every opted-in user's entry and every opted-in household's entry at once.
const getGlobalLeaderboard = async (): Promise<{ entries: GlobalLeaderboardEntries; householdEntries: GlobalHouseholdLeaderboardEntries }> => {
  try {
    const snap = await DatabaseMonitoringService.getDoc(getCacheRef());
    if (snap.exists()) {
      const data = snap.data();
      return {
        entries: (data?.entries as GlobalLeaderboardEntries) || {},
        householdEntries: (data?.householdEntries as GlobalHouseholdLeaderboardEntries) || {},
      };
    }
    return { entries: {}, householdEntries: {} };
  } catch (err: any) {
    log.error('Failed to load global leaderboard cache', { error: err?.message }, 'LeaderboardCacheService');
    return { entries: {}, householdEntries: {} };
  }
};

// 1 write: update only this user's slot in the shared doc.
const upsertMyEntry = async (userId: string, entry: GlobalLeaderboardEntry): Promise<void> => {
  const cacheRef = getCacheRef();
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      version: CACHE_VERSION,
      [`entries.${userId}`]: entry,
    });
  } catch {
    // Doc doesn't exist yet (first opt-in ever) — merge-create it instead.
    try {
      await DatabaseMonitoringService.setDoc(cacheRef, {
        version: CACHE_VERSION,
        entries: { [userId]: entry },
        householdEntries: {},
      }, { merge: true });
    } catch (err: any) {
      log.error('Failed to upsert leaderboard entry', { error: err?.message }, 'LeaderboardCacheService');
      throw err;
    }
  }
};

// 1 write: drop this user's slot (leaving the leaderboard).
const removeMyEntry = async (userId: string): Promise<void> => {
  try {
    await DatabaseMonitoringService.updateDoc(getCacheRef(), {
      [`entries.${userId}`]: DatabaseMonitoringService.deleteField(),
    });
  } catch (err: any) {
    log.error('Failed to remove leaderboard entry', { error: err?.message }, 'LeaderboardCacheService');
  }
};

// 1 write: update only this household's slot in the shared doc. Any opted-in member
// of the household can write it (whoever's client last recomputed the score).
const upsertMyHouseholdEntry = async (householdId: string, entry: GlobalHouseholdLeaderboardEntry): Promise<void> => {
  const cacheRef = getCacheRef();
  try {
    await DatabaseMonitoringService.updateDoc(cacheRef, {
      version: CACHE_VERSION,
      [`householdEntries.${householdId}`]: entry,
    });
  } catch {
    // Doc doesn't exist yet (first opt-in ever) — merge-create it instead.
    try {
      await DatabaseMonitoringService.setDoc(cacheRef, {
        version: CACHE_VERSION,
        entries: {},
        householdEntries: { [householdId]: entry },
      }, { merge: true });
    } catch (err: any) {
      log.error('Failed to upsert household leaderboard entry', { error: err?.message }, 'LeaderboardCacheService');
      throw err;
    }
  }
};

// 1 write: drop this household's slot (leaving the leaderboard).
const removeMyHouseholdEntry = async (householdId: string): Promise<void> => {
  try {
    await DatabaseMonitoringService.updateDoc(getCacheRef(), {
      [`householdEntries.${householdId}`]: DatabaseMonitoringService.deleteField(),
    });
  } catch (err: any) {
    log.error('Failed to remove household leaderboard entry', { error: err?.message }, 'LeaderboardCacheService');
  }
};

export const LeaderboardCacheService = {
  CACHE_VERSION,
  getGlobalLeaderboard,
  upsertMyEntry,
  removeMyEntry,
  upsertMyHouseholdEntry,
  removeMyHouseholdEntry,
};
