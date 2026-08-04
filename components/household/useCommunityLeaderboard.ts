import { useEffect, useMemo, useState } from 'react';
import { Household } from '../../types';
import {
  LeaderboardCacheService,
  GlobalLeaderboardEntries,
  GlobalHouseholdLeaderboardEntries,
} from '../../services/LeaderboardCacheService';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  isUser: boolean;
  score: number;
  /** null when this is a real household member whose individual streak isn't tracked (streaks are device-local). */
  streak: number | null;
  /** null when this is a real household member whose individual badge count isn't tracked. */
  badges: number | null;
  isHousehold: boolean;
  /** True for real household members (not the current user, not simulated peers) — same shared pantry score, unknown streak/badges. */
  isRealMember?: boolean;
}

interface UseCommunityLeaderboardArgs {
  user?: { id: string; name: string };
  household: Household | null;
  userScore: number;
  userStreak: number;
  unlockedBadgesCount: number;
  confirm: (opts: {
    title: string;
    description: string;
    variant: 'danger';
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
}

/**
 * Owns all pantry-score leaderboard state: opt-in/profile settings persisted to
 * localStorage, the shared global leaderboard cache (1 read on mount, debounced
 * writes on score change), and the derived, sorted leaderboard rows for both the
 * individual and household views. Extracted from Community.tsx (F37).
 */
export function useCommunityLeaderboard({
  user,
  household,
  userScore,
  userStreak,
  unlockedBadgesCount,
  confirm,
}: UseCommunityLeaderboardArgs) {
  const [leaderboardType, setLeaderboardType] = useState<'individual' | 'household'>('individual');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'weekly' | 'monthly'>('weekly');

  const [optedIn, setOptedIn] = useState(() => localStorage.getItem('pantryLeaderboardOptIn') === 'true');
  const [leaderboardName, setLeaderboardName] = useState(() => localStorage.getItem('pantryLeaderboardName') || user?.name || 'Pantry Champ');
  const [isAnonymous, setIsAnonymous] = useState(() => localStorage.getItem('pantryLeaderboardAnon') === 'true');

  // Global leaderboard cache: everyone opted-in shares one document (individual entries
  // keyed by uid, household entries keyed by householdId), so loading it is 1 read and
  // logging a score is 1 write each (see LeaderboardCacheService).
  const [globalEntries, setGlobalEntries] = useState<GlobalLeaderboardEntries>({});
  const [globalHouseholdEntries, setGlobalHouseholdEntries] = useState<GlobalHouseholdLeaderboardEntries>({});

  useEffect(() => {
    let cancelled = false;
    LeaderboardCacheService.getGlobalLeaderboard().then(({ entries, householdEntries }) => {
      if (!cancelled) {
        setGlobalEntries(entries);
        setGlobalHouseholdEntries(householdEntries);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleLeaveLeaderboard = async () => {
    const ok = await confirm({
      title: 'Leave the leaderboard?',
      description: 'Your profile and rankings will no longer be visible to other members.',
      variant: 'danger',
      confirmLabel: 'Leave Leaderboard',
      cancelLabel: 'Stay',
    });
    if (ok) {
      localStorage.removeItem('pantryLeaderboardOptIn');
      setOptedIn(false);
      if (user?.id) {
        LeaderboardCacheService.removeMyEntry(user.id).catch(() => {});
        setGlobalEntries(prev => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
      }
      if (household?.id) {
        LeaderboardCacheService.removeMyHouseholdEntry(household.id).catch(() => {});
        setGlobalHouseholdEntries(prev => {
          const next = { ...prev };
          delete next[household.id];
          return next;
        });
      }
    }
  };

  // Log this user's own score, and (if in a household) the household's shared score,
  // to the shared global leaderboard doc — 1 write each — whenever they change,
  // debounced so scrolling/rerenders don't spam Firestore.
  useEffect(() => {
    if (!optedIn || !user?.id) return;
    const entry = {
      name: isAnonymous ? 'Pantry Champ' : leaderboardName,
      score: userScore,
      streak: userStreak,
      badges: unlockedBadgesCount,
      isHousehold: household !== null,
      isAnonymous,
      updatedAt: new Date().toISOString(),
    };
    const householdEntry = household ? {
      name: household.name,
      score: userScore,
      streak: userStreak,
      badges: unlockedBadgesCount,
      memberCount: (household.members || []).filter(m => m.status === 'active').length,
      updatedAt: new Date().toISOString(),
    } : null;
    const timeout = setTimeout(() => {
      LeaderboardCacheService.upsertMyEntry(user.id, entry).catch(() => {});
      setGlobalEntries(prev => ({ ...prev, [user.id]: entry }));
      if (household?.id && householdEntry) {
        LeaderboardCacheService.upsertMyHouseholdEntry(household.id, householdEntry).catch(() => {});
        setGlobalHouseholdEntries(prev => ({ ...prev, [household.id]: householdEntry }));
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [optedIn, user?.id, isAnonymous, leaderboardName, userScore, userStreak, unlockedBadgesCount, household]);

  // Dynamic Leaderboard Rankings
  const leaderboardData = useMemo((): LeaderboardEntry[] => {
    // Generate realistic peers with scores centered around the user's performance
    const basePeers: Omit<LeaderboardEntry, 'rank'>[] = [
      { id: 'peer_greenfield', name: 'The Greenfield Home', isUser: false, score: 95, streak: 8, badges: 7, isHousehold: true },
      { id: 'peer_sarah', name: 'Chef Sarah', isUser: false, score: 91, streak: 5, badges: 6, isHousehold: false },
      { id: 'peer_zerowaste', name: 'ZeroWasteFam', isUser: false, score: 87, streak: 12, badges: 5, isHousehold: true },
      { id: 'peer_budget', name: 'BudgetBites', isUser: false, score: 82, streak: 4, badges: 4, isHousehold: false },
      { id: 'peer_fresh', name: 'FreshStart', isUser: false, score: 69, streak: 1, badges: 2, isHousehold: false },
      { id: 'peer_staples', name: 'StaplesOnly', isUser: false, score: 54, streak: 0, badges: 1, isHousehold: false },
    ];

    // Add user entry (individual view)
    const userEntry: Omit<LeaderboardEntry, 'rank'> = {
      id: `user_${user?.id || 'me'}`,
      name: isAnonymous ? 'Pantry Champ (You)' : `${leaderboardName} (You)`,
      isUser: true,
      score: userScore,
      streak: userStreak,
      badges: unlockedBadgesCount,
      isHousehold: false
    };

    // The current user's household, as its own leaderboard row (household view). Only
    // present when the user actually belongs to a household.
    const householdSelfEntry: Omit<LeaderboardEntry, 'rank'> | null = household ? {
      id: `household_${household.id}`,
      name: `${household.name} (You)`,
      isUser: true,
      score: userScore,
      streak: userStreak,
      badges: unlockedBadgesCount,
      isHousehold: true
    } : null;

    // Other opted-in households' real scores, read from the shared global leaderboard cache.
    const globalHouseholdPeerEntries: Omit<LeaderboardEntry, 'rank'>[] = Object.entries(globalHouseholdEntries)
      .filter(([id]) => id !== household?.id)
      .map(([id, e]) => ({
        id: `household_${id}`,
        name: e.name,
        isUser: false,
        score: e.score,
        streak: e.streak,
        badges: e.badges,
        isHousehold: true,
        isRealMember: true,
      }));

    // Real household members share the same pantry (and therefore the same score) as the
    // current user — streak/badges are device-local and not tracked per-member, so those
    // are left unknown (null) rather than fabricated.
    const realMemberEntries: Omit<LeaderboardEntry, 'rank'>[] = (household?.members || [])
      .filter(m => m.id !== user?.id && m.status === 'active')
      .map(m => ({
        id: `user_${m.id}`,
        name: m.name,
        isUser: false,
        score: userScore,
        streak: null,
        badges: null,
        isHousehold: false,
        isRealMember: true,
      }));

    // Other opted-in users' real scores, read from the shared global leaderboard cache.
    // Individual view membership doesn't depend on whether that user also belongs to a
    // household — every opted-in user gets one row here.
    const globalPeerEntries: Omit<LeaderboardEntry, 'rank'>[] = Object.entries(globalEntries)
      .filter(([id]) => id !== user?.id)
      .map(([id, e]) => ({
        id: `user_${id}`,
        name: e.name,
        isUser: false,
        score: e.score,
        streak: e.streak,
        badges: e.badges,
        isHousehold: false,
        isRealMember: true,
      }));

    // Simulated filler entries only pad each view while few real opted-in
    // users/households exist yet, so the leaderboard doesn't look empty early on.
    const fillerIndividualPeers = basePeers.filter(p => !p.isHousehold);
    const fillerHouseholdPeers = basePeers.filter(p => p.isHousehold);
    const fillerPeers = leaderboardType === 'household'
      ? (globalHouseholdPeerEntries.length >= 3 ? [] : fillerHouseholdPeers.slice(0, 3 - globalHouseholdPeerEntries.length))
      : (globalPeerEntries.length >= 3 ? [] : fillerIndividualPeers.slice(0, 3 - globalPeerEntries.length));

    const allEntries = leaderboardType === 'household'
      ? [...fillerPeers, ...globalHouseholdPeerEntries, ...(householdSelfEntry ? [householdSelfEntry] : [])]
      : [...fillerPeers, ...globalPeerEntries, ...realMemberEntries, userEntry];

    // allEntries is already scoped to the active view (individual vs household) above.
    let filtered = allEntries;

    // Weekly vs Monthly slight score adjustments for dynamic feeling — only applied to
    // simulated peers; real entries (the user and real household members) keep their actual data.
    if (leaderboardTimeframe === 'monthly') {
      filtered = filtered.map(e => {
        if (e.isUser || e.isRealMember) return e;
        return {
          ...e,
          score: Math.max(40, Math.min(100, e.score + (e.score % 3 === 0 ? 2 : -2))),
          streak: (e.streak ?? 0) * 4
        };
      });
    }

    // Sort: Score desc, then streak desc (unknown streaks sort last), then badges desc
    return filtered
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.streak ?? -1) !== (a.streak ?? -1)) return (b.streak ?? -1) - (a.streak ?? -1);
        return (b.badges ?? -1) - (a.badges ?? -1);
      })
      .map((e, index) => ({
        ...e,
        rank: index + 1
      }));
  }, [userScore, userStreak, unlockedBadgesCount, household, leaderboardType, leaderboardTimeframe, isAnonymous, leaderboardName, user?.id, globalEntries, globalHouseholdEntries]);

  const userRank = useMemo(() => {
    const entry = leaderboardData.find(e => e.isUser);
    return entry ? entry.rank : 1;
  }, [leaderboardData]);

  const handleJoinLeaderboard = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pantryLeaderboardOptIn', 'true');
    localStorage.setItem('pantryLeaderboardName', leaderboardName);
    localStorage.setItem('pantryLeaderboardAnon', String(isAnonymous));
    setOptedIn(true);
  };

  return {
    leaderboardType,
    setLeaderboardType,
    leaderboardTimeframe,
    setLeaderboardTimeframe,
    optedIn,
    leaderboardName,
    setLeaderboardName,
    isAnonymous,
    setIsAnonymous,
    leaderboardData,
    userRank,
    handleJoinLeaderboard,
    handleLeaveLeaderboard,
  };
}
