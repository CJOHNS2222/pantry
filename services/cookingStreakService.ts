import { arrayUnion } from 'firebase/firestore';
import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';

/**
 * Cooking streak — how many consecutive days in a row the user has marked a meal
 * "Cooked". Backed by `users/{uid}.cookingStreakDates` (a small capped array of ISO
 * date strings) so it survives reinstalls/device switches and can feed the household
 * leaderboard, instead of living only in per-device localStorage.
 *
 * localStorage stays as an instant-read cache (same key as before, for backward
 * compatibility) so the UI never blocks on a Firestore round-trip — it's seeded from
 * the server on login (see hooks/useAuth.ts) and updated optimistically on write.
 * Writes are cheap: at most one small `arrayUnion` per user per day (the calendar-day
 * dedupe check below skips the write entirely once today is already recorded).
 */

const STREAK_KEY = 'cookingStreakDates';
const MAX_DATES = 30;

function readLocalDates(): string[] {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDates(dates: string[]): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(dates.slice(-MAX_DATES)));
  } catch {
    // localStorage unavailable — streak just won't persist locally this session
  }
}

/** Pure: consecutive-day streak ending today or yesterday, from a list of ISO date strings. */
export function computeStreak(dates: string[]): number {
  if (!Array.isArray(dates) || dates.length === 0) return 0;

  const sorted = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const latest = sorted[0];
  if (latest !== todayStr && latest !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diffDays = Math.ceil(Math.abs(new Date(sorted[i]).getTime() - new Date(sorted[i + 1]).getTime()) / 86400000);
    if (diffDays === 1) streak++;
    else if (diffDays > 1) break;
  }
  return streak;
}

/** Current cooking streak, from the local cache (kept in sync with Firestore). */
export function getCookingStreak(): number {
  return computeStreak(readLocalDates());
}

/**
 * Merges the server's cooking-streak dates into the local cache. Called on login so a
 * streak built on another device shows up here too. Takes the union rather than just
 * overwriting, so an offline "cooked today" that hasn't synced yet isn't lost.
 */
export function seedCookingStreakFromServer(serverDates: string[] | undefined): void {
  if (!serverDates || serverDates.length === 0) return;
  const merged = [...new Set([...readLocalDates(), ...serverDates])]
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  writeLocalDates(merged);
}

/**
 * Records today as cooked: updates the local cache immediately (optimistic) and syncs
 * one small `arrayUnion` write to the user's Firestore doc. No-ops (no write) if today
 * is already recorded. Returns the resulting streak length.
 */
export async function recordCookedToday(userId?: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const existing = readLocalDates();

  if (existing.includes(today)) {
    return computeStreak(existing);
  }

  const next = [...existing, today];
  writeLocalDates(next);

  if (userId) {
    try {
      const userRef = DatabaseMonitoringService.doc('users', userId);
      await DatabaseMonitoringService.updateDoc(userRef, {
        cookingStreakDates: arrayUnion(today)
      });
    } catch (err) {
      log.error('Failed to sync cooking streak to Firestore', { err }, 'cookingStreakService');
    }
  }

  return computeStreak(next);
}
