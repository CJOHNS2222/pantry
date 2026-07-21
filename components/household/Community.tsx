import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { Tab } from '../../types/app';
import { ProgressBar, BottomSheet } from '../ui';
import { PantryHealthScore } from '../pantry/PantryHealthScore';
import { 
  Star, 
  Plus, 
  UtensilsCrossed, 
  Trophy, 
  Award, 
  Flame, 
  Lock, 
  CheckCircle, 
  TrendingUp, 
  Sparkles, 
  Share2, 
  Users, 
  User, 
  Info, 
  DollarSign,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { RecipeRating, StructuredRecipe } from '../../types';
import RecipeModal from '../recipes-meals/RecipeModal';
import { getCachedCommunityRatedRecipes } from '../../services/recipeService';
import { log } from '../../services/logService';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { hasMilestone } from '../../services/onboardingMilestoneService';

// Staple items to ignore in ingredient display
const _STAPLES = ['salt', 'pepper', 'oil', 'water', 'flour', 'sugar', 'butter', 'vinegar', 'baking powder', 'baking soda', 'spices', 'seasoning', 'soy sauce', 'cornstarch', 'yeast'];

interface CommunityProps {
  onAddToPlan: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    profile?: {
      householdSize?: number;
    };
  };
}

interface RecipeStats {
  title: string;
  totalRating: number;
  count: number;
  comments: RecipeRating[];
}

interface LeaderboardEntry {
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

import { calculatePantryScore, getCookingStreak, AchievementBadge } from '../../utils/achievementUtils';

const CommunityComponent: React.FC<CommunityProps> = ({ onAddToPlan, onSaveRecipe, user }) => {
  const app = useApp();
  const { isLoadingRatings, setLoadingRatingsComplete, inventory = [], savedRecipes = [], mealPlan = [], household = null } = app;
  const { setActiveTab, onRateRecipe, addToast } = useAppActions();
  const confirm = useConfirm();
  
  // Navigation & Toggle State
  const [subTab, setSubTab] = useState<'recipes' | 'leaderboard' | 'achievements'>('recipes');
  const [leaderboardType, setLeaderboardType] = useState<'individual' | 'household'>('individual');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  
  // Leaderboard Opt-In State
  const [optedIn, setOptedIn] = useState(() => localStorage.getItem('pantryLeaderboardOptIn') === 'true');
  const [leaderboardName, setLeaderboardName] = useState(() => localStorage.getItem('pantryLeaderboardName') || user?.name || 'Pantry Champ');
  const [isAnonymous, setIsAnonymous] = useState(() => localStorage.getItem('pantryLeaderboardAnon') === 'true');

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
    }
  };
  
  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<{ title: string, comments: RecipeRating[] } | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [showWasteReport, setShowWasteReport] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);

  const [localLoading, setLocalLoading] = useState(false);
  const [ratingsState, setRatingsState] = useState<RecipeRating[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const celebrationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationFrameRef.current !== null) {
        cancelAnimationFrame(celebrationFrameRef.current);
      }
    };
  }, []);

  // Onboarding checklist tracking relocated to Social tab
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(true);
  const [isChecklistDismissed, setIsChecklistDismissed] = useState(() => {
    try {
      return localStorage.getItem('onboarding-checklist-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  interface ChecklistStep {
    id: string;
    label: string;
    description: string;
    isCompleted: boolean;
    action: () => void;
    actionLabel: string;
  }

  const checklistSteps = useMemo((): ChecklistStep[] => {
    const pSaved = hasMilestone('first-recipe-saved');
    const mPlanned = hasMilestone('first-meal-planned');
    const hSetup = hasMilestone('household-setup');
    const lLogged = hasMilestone('first-leftover-logged');
    const pItemsCount = inventory.length;
    
    return [
      {
        id: 'add-items',
        label: 'Add 5 Pantry Items',
        description: `Add ingredients to unlock smart recommendations. (${pItemsCount}/5)`,
        isCompleted: pItemsCount >= 5,
        action: () => {
          try {
            sessionStorage.setItem('open-pantry-add-modal', 'true');
          } catch (e) {
            log.error('Failed to write open-pantry-add-modal to sessionStorage', { error: e }, 'Community');
            return;
          }
          if (setActiveTab) setActiveTab(Tab.PANTRY);
        },
        actionLabel: 'Add Items'
      },
      {
        id: 'save-recipe',
        label: 'Save a Recipe',
        description: 'Explore recipes in the Chef tab and heart one to save it.',
        isCompleted: pSaved,
        action: () => { if (setActiveTab) setActiveTab(Tab.RECIPES); },
        actionLabel: 'Browse Recipes'
      },
      {
        id: 'plan-meal',
        label: 'Plan a Meal',
        description: 'Add a planned meal or saved recipe to your weekly calendar.',
        isCompleted: mPlanned,
        action: () => { if (setActiveTab) setActiveTab(Tab.MEALS); },
        actionLabel: 'Open Planner'
      },
      {
        id: 'household-share',
        label: 'Set up Household Sharing',
        description: 'Invite family members or roommates to sync in real-time.',
        isCompleted: hSetup,
        action: () => { if (setActiveTab) setActiveTab(Tab.SETTINGS); },
        actionLabel: 'Set up Sharing'
      },
      {
        id: 'log-leftover',
        label: 'Record a Leftover',
        description: 'Log leftovers with a tap to track food safety and waste.',
        isCompleted: lLogged,
        action: () => {
          try {
            sessionStorage.setItem('open-pantry-add-modal', 'true');
          } catch (e) {
            log.error('Failed to write open-pantry-add-modal to sessionStorage', { error: e }, 'Community');
            return;
          }
          if (setActiveTab) setActiveTab(Tab.PANTRY);
        },
        actionLabel: 'Log Leftover'
      }
    ];
  }, [inventory.length, setActiveTab]);

  const completedChecklistCount = useMemo(() => {
    return checklistSteps.filter(s => s.isCompleted).length;
  }, [checklistSteps]);

  const dismissChecklist = () => {
    setIsChecklistDismissed(true);
    try {
      localStorage.setItem('onboarding-checklist-dismissed', 'true');
    } catch (e) {
      log.error('Failed to save onboarding-checklist-dismissed to localStorage', { error: e }, 'Community');
      return;
    }
  };

  const triggerCelebration = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      alpha: number;
      decay: number;
      gravity: number;
    }

    const particles: Particle[] = [];
    const colors = ['#ff0055', '#00ffcc', '#ffcc00', '#ff6600', '#9900ff', '#33ccff', '#ff33aa', '#00ff66'];

    const createExplosion = (x: number, y: number) => {
      const count = 50 + Math.random() * 30;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 6;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (0.5 + Math.random() * 1.5),
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.015,
          gravity: 0.12,
        });
      }
    };

    const w = canvas.width;
    const h = canvas.height;
    
    // Burst fireworks in a sequence
    createExplosion(w / 2, h / 2);
    setTimeout(() => createExplosion(w * 0.25, h * 0.45), 200);
    setTimeout(() => createExplosion(w * 0.75, h * 0.45), 400);
    setTimeout(() => createExplosion(w * 0.5, h * 0.35), 600);

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (particles.length > 0) {
        celebrationFrameRef.current = requestAnimationFrame(drawFrame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        celebrationFrameRef.current = null;
      }
    };

    celebrationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const handleBadgeClick = (badge: AchievementBadge) => {
    setSelectedBadge(badge);
    if (badge.isUnlocked) {
      addToast(`🎉 Achievement Unlocked: ${badge.title}! ${badge.icon}`, 'success', 5000);
      setTimeout(() => {
        triggerCelebration();
      }, 100);
    }
  };

  useAndroidBack(showModal || !!selectedBadge || showWasteReport, () => {
    setShowModal(false);
    setSelectedBadge(null);
    setShowWasteReport(false);
  });
  useAndroidBack(showHealthDetail, () => setShowHealthDetail(false));

  // Load community-rated cache once
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLocalLoading(true);
        const cached = await getCachedCommunityRatedRecipes();
        if (!mounted) return;

        if (Array.isArray(cached) && cached.length > 0) {
          const first = cached[0] as unknown as Record<string, unknown>;
          if (first && (first.recipeTitle || first.comment || first.userName)) {
            const ratings: RecipeRating[] = cached.map((r) => {
              const item = r as unknown as Record<string, unknown>;
              return {
                id: String(item.id || ''),
                recipeTitle: String(item.recipeTitle || ''),
                rating: Number(item.rating || 0),
                comment: String(item.comment || ''),
                userName: String(item.userName || ''),
                date: String(item.date || ''),
                recipe: item.recipe as StructuredRecipe | undefined
              };
            });
            setRatingsState(ratings);
          } else {
            const synthetic: RecipeRating[] = cached.map((r, i: number) => {
              const item = r as unknown as Record<string, unknown>;
              const averageRating = item.averageRating;
              const lastUpdated = item.lastUpdated;
              return {
                id: r.id || `community_${i}`,
                recipeTitle: r.title || 'Untitled',
                rating: (typeof averageRating === 'number' ? Math.round(averageRating * 10) / 10 : 0),
                comment: r.description || '',
                userName: 'Community',
                date: String(lastUpdated || r.dateSaved || new Date().toISOString()),
                recipe: r
              };
            });
            setRatingsState(synthetic);
          }
        }
      } catch (e) {
        log.error('Failed to load cached community recipes', { error: e }, 'Community');
        return;
      } finally {
        if (mounted) {
          setLocalLoading(false);
          setLoadingRatingsComplete();
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Group ratings by recipe title and calculate average
  const recipeStats = ratingsState.reduce((acc, curr) => {
    const key = curr.recipeTitle || 'Untitled';
    if (!key || key === 'Untitled' || !curr.recipeTitle) {
      return acc;
    }
    if (!acc[key]) {
      acc[key] = {
        title: key,
        totalRating: 0,
        count: 0,
        comments: []
      };
    }
    acc[key].totalRating += (typeof curr.rating === 'number' ? curr.rating : 0);
    acc[key].count += 1;
    acc[key].comments.push(curr);
    return acc;
  }, {} as Record<string, RecipeStats>);

  const sortedRecipes = Object.values(recipeStats)
    .filter((stat): stat is RecipeStats => {
      const s = stat as RecipeStats;
      return !!(s && typeof s === 'object' && 'count' in s && 'title' in s &&
             s.count > 0 && s.title && s.title !== 'Untitled');
    })
    .sort((a, b) => (b.totalRating / Math.max(1, b.count)) - (a.totalRating / Math.max(1, a.count)));
    
  const [showAll, setShowAll] = useState(false);
  
  const findRecipeForStat = (stat: { comments: RecipeRating[] }) => {
    const ratingWithRecipe = stat.comments.find(c => c.recipe);
    return ratingWithRecipe ? ratingWithRecipe.recipe : null;
  };

  const sanitizeRecipeForSave = (r: StructuredRecipe): StructuredRecipe => {
    const placeholderPattern = /Full recipe not available in this rating/i;
    const sanitized: StructuredRecipe = {
      title: r.title || '',
      description: r.description || '',
      ingredients: Array.isArray(r.ingredients) ? [...r.ingredients] : [],
      instructions: Array.isArray(r.instructions) ? [...r.instructions] : [],
      cookTime: r.cookTime || '',
      image: r.image
    };

    if (sanitized.ingredients.length === 1 && placeholderPattern.test(String(sanitized.ingredients[0]))) {
      sanitized.ingredients = [];
    }
    if (sanitized.instructions.length === 1 && placeholderPattern.test(String(sanitized.instructions[0]))) {
      sanitized.instructions = [];
    }

    return sanitized;
  };

  // Live Stats Calculation
  const userScore = useMemo(() => calculatePantryScore(inventory), [inventory]);
  const userStreak = useMemo(() => getCookingStreak(), []);
  
  const expiredCount = useMemo(() => {
    return inventory.filter(i => {
      if (!i.expirationDate) return false;
      return new Date(i.expirationDate).getTime() < Date.now();
    }).length;
  }, [inventory]);

  const uniqueCategoriesCount = useMemo(() => {
    return new Set(inventory.map(i => i.category || 'other')).size;
  }, [inventory]);

  const hasMealsPlanned = useMemo(() => {
    return mealPlan.some(day => (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0) > 0);
  }, [mealPlan]);

  // Dynamic Achievements Badges System
  const achievementsList = useMemo((): AchievementBadge[] => {
    const list: Omit<AchievementBadge, 'isUnlocked'>[] = [
      {
        id: 'waste_warrior',
        title: 'Waste Warrior',
        description: 'Have zero expired items in your pantry with at least 5 items tracked.',
        icon: '🥬',
        color: 'from-green-400 to-emerald-600',
        targetValue: 5,
        currentValue: expiredCount === 0 ? Math.min(5, inventory.length) : 0,
        unit: 'items',
        tip: expiredCount > 0 ? `Remove the ${expiredCount} expired items to unlock this badge!` : 'Keep your pantry clean of expired goods.'
      },
      {
        id: 'master_chef',
        title: 'Master Chef',
        description: 'Save at least 5 delicious recipes to your personal recipe box.',
        icon: '🍳',
        color: 'from-orange-400 to-red-600',
        targetValue: 5,
        currentValue: savedRecipes.length,
        unit: 'recipes',
        tip: 'Find recipes you love under the Chef tab and tap Save Recipe.'
      },
      {
        id: 'pantry_architect',
        title: 'Pantry Architect',
        description: 'Diversify your inventory by stocking items across 4 distinct categories.',
        icon: '🌈',
        color: 'from-purple-400 to-indigo-600',
        targetValue: 4,
        currentValue: uniqueCategoriesCount,
        unit: 'categories',
        tip: 'Try adding items in different categories like Produce, Grains, Dairy, and Spices.'
      },
      {
        id: 'scan_master',
        title: 'Scan Master',
        description: 'Add at least 10 items to your pantry to build a healthy stock.',
        icon: '📦',
        color: 'from-blue-400 to-cyan-600',
        targetValue: 10,
        currentValue: inventory.length,
        unit: 'items',
        tip: 'Quick Add or scan barcodes to log your staples and ingredients.'
      },
      {
        id: 'streak_builder',
        title: 'Streak Builder',
        description: 'Reach a consecutive 2-day cooking streak by preparing planned meals.',
        icon: '🔥',
        color: 'from-amber-400 to-orange-500',
        targetValue: 2,
        currentValue: userStreak,
        unit: 'days',
        tip: 'Mark your planned meals as made on consecutive days to maintain your cooking streak.'
      },
      {
        id: 'freshness_guru',
        title: 'Freshness Guru',
        description: 'Maintain an excellent Pantry Health Score of 85 or above.',
        icon: '💎',
        color: 'from-teal-400 to-emerald-500',
        targetValue: 85,
        currentValue: userScore,
        unit: 'points',
        tip: 'Keep your items fresh, track expiration dates, and restock regularly.'
      },
      {
        id: 'meal_planner',
        title: 'Meal Planner',
        description: 'Schedule at least one meal in your calendar to prepare for the week.',
        icon: '📅',
        color: 'from-pink-400 to-rose-500',
        targetValue: 1,
        currentValue: hasMealsPlanned ? 1 : 0,
        unit: 'meals',
        tip: 'Go to the Plan tab and add any recipe to your breakfast, lunch, or dinner slots.'
      },
      {
        id: 'eco_collaborator',
        title: 'Eco Collaborator',
        description: 'Link your pantry with a household member to coordinate shopping and waste.',
        icon: '🤝',
        color: 'from-violet-400 to-fuchsia-600',
        targetValue: 1,
        currentValue: household ? 1 : 0,
        unit: 'collaborators',
        tip: 'Invite a family member or roommate to join your household from Settings!'
      }
    ];

    return list.map(badge => {
      let isUnlocked: boolean;
      if (badge.id === 'waste_warrior') {
        isUnlocked = inventory.length >= 5 && expiredCount === 0;
      } else if (badge.id === 'freshness_guru') {
        isUnlocked = userScore >= 85 && inventory.length > 0;
      } else {
        isUnlocked = badge.currentValue >= badge.targetValue;
      }
      return { ...badge, isUnlocked };
    });
  }, [inventory.length, expiredCount, savedRecipes.length, uniqueCategoriesCount, userStreak, userScore, hasMealsPlanned, household]);

  const unlockedBadgesCount = useMemo(() => {
    return achievementsList.filter(a => a.isUnlocked).length;
  }, [achievementsList]);

  // Dynamic Leaderboard Rankings
  const leaderboardData = useMemo((): LeaderboardEntry[] => {
    // Generate realistic peers with scores centered around the user's performance
    const basePeers: Omit<LeaderboardEntry, 'rank'>[] = [
      {
        name: 'The Greenfield Home',
        isUser: false,
        score: 95,
        streak: 8,
        badges: 7,
        isHousehold: true
      },
      {
        name: 'Chef Sarah',
        isUser: false,
        score: 91,
        streak: 5,
        badges: 6,
        isHousehold: false
      },
      {
        name: 'ZeroWasteFam',
        isUser: false,
        score: 87,
        streak: 12,
        badges: 5,
        isHousehold: true
      },
      {
        name: 'BudgetBites',
        isUser: false,
        score: 82,
        streak: 4,
        badges: 4,
        isHousehold: false
      },
      {
        name: 'FreshStart',
        isUser: false,
        score: 69,
        streak: 1,
        badges: 2,
        isHousehold: false
      },
      {
        name: 'StaplesOnly',
        isUser: false,
        score: 54,
        streak: 0,
        badges: 1,
        isHousehold: false
      }
    ];

    // Add user entry
    const userEntry: Omit<LeaderboardEntry, 'rank'> = {
      name: isAnonymous ? 'Pantry Champ (You)' : `${leaderboardName} (You)`,
      isUser: true,
      score: userScore,
      streak: userStreak,
      badges: unlockedBadgesCount,
      isHousehold: household !== null
    };

    // Real household members share the same pantry (and therefore the same score) as the
    // current user — streak/badges are device-local and not tracked per-member, so those
    // are left unknown (null) rather than fabricated.
    const realMemberEntries: Omit<LeaderboardEntry, 'rank'>[] = (household?.members || [])
      .filter(m => m.id !== user?.id && m.status === 'active')
      .map(m => ({
        name: m.name,
        isUser: false,
        score: userScore,
        streak: null,
        badges: null,
        isHousehold: false,
        isRealMember: true,
      }));

    const allEntries = [...basePeers, ...realMemberEntries, userEntry];

    // Filter by type (individual vs household)
    let filtered = leaderboardType === 'household'
      ? allEntries.filter(e => e.isHousehold || e.isUser) // Always include user for context
      : allEntries.filter(e => !e.isHousehold || e.isUser);

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
  }, [userScore, userStreak, unlockedBadgesCount, household, leaderboardType, leaderboardTimeframe, isAnonymous, leaderboardName, user?.id]);

  const userRank = useMemo(() => {
    const entry = leaderboardData.find(e => e.isUser);
    return entry ? entry.rank : 1;
  }, [leaderboardData]);

  // Handle Leaderboard Join
  const handleJoinLeaderboard = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('pantryLeaderboardOptIn', 'true');
    localStorage.setItem('pantryLeaderboardName', leaderboardName);
    localStorage.setItem('pantryLeaderboardAnon', String(isAnonymous));
    setOptedIn(true);
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Dynamic Tab Switcher */}
      <div className="sticky top-0 z-40 bg-theme-primary py-3 -mx-4 px-4 border-b border-theme/40 shadow-sm md:-mx-8 md:px-8">
        <div className="flex bg-theme-secondary rounded-xl p-1 border border-theme shadow-sm">
          <button
            onClick={() => setSubTab('recipes')}
            className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'recipes'
                ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
                : 'text-theme-secondary opacity-60 hover:opacity-100'
            }`}
          >
            Favorites
          </button>
          <button
            onClick={() => setSubTab('leaderboard')}
            className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'leaderboard'
                ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
                : 'text-theme-secondary opacity-60 hover:opacity-100'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setSubTab('achievements')}
            className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'achievements'
                ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
                : 'text-theme-secondary opacity-60 hover:opacity-100'
            }`}
          >
            Achievements
          </button>
        </div>
      </div>

      {/* ────────────────── SUBTAB 1: COMMUNITY RECIPES ────────────────── */}
      {subTab === 'recipes' && (
        <>
          {(isLoadingRatings || localLoading) && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)] mx-auto mb-4"></div>
              <p className="text-theme-secondary opacity-70">Loading community ratings…</p>
            </div>
          )}
          <div className="text-center mb-2">
            <h2 className="text-3xl font-serif font-bold text-theme-secondary">Community Favorites</h2>
            <p className="text-theme-secondary opacity-60 text-sm mt-1">Top rated recipes by our users</p>
          </div>

          <div className="space-y-4">
            {sortedRecipes.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-amber-500/30 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-theme-secondary mb-2">No Community Ratings Yet</h3>
                <p className="text-theme-secondary opacity-60 text-sm mb-4">
                  Be the first to rate a recipe! Save and rate recipes to see them here.
                </p>
                <p className="text-sm text-theme-secondary opacity-70 mb-4">
                  Start by opening Chef and rating one of your saved recipes.
                </p>
                <button
                  onClick={() => setActiveTab(Tab.RECIPES)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-color)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Find &amp; Rate Recipes
                </button>
              </div>
            ) : (
              <>
                {(showAll ? sortedRecipes : sortedRecipes.slice(0, 5)).map((stat) => {
                  const avg = (stat.totalRating / stat.count).toFixed(1);
                  const latestComment = stat.comments && stat.comments[0] ? stat.comments[0] : null;
                  const fullRecipe = findRecipeForStat(stat);
                  
                  return (
                    <div 
                      key={stat.title} 
                      className="bg-theme-secondary rounded-xl border border-theme shadow-lg overflow-hidden group hover:shadow-xl transition-all cursor-pointer"
                      onClick={() => { setSelectedRecipe(stat); setShowModal(true); }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open community ratings for ${stat.title}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRecipe(stat);
                          setShowModal(true);
                        }
                      }}
                    >
                      {/* Recipe Image Header */}
                      <div className="h-32 bg-gray-200 relative overflow-hidden">
                        {fullRecipe?.image ? (
                          <img
                            src={fullRecipe?.image}
                            alt={stat.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target) {
                                target.style.display = 'none';
                                const fallback = target.parentElement?.querySelector('.fallback-text') as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/10 via-theme-primary to-orange-500/5 dark:from-amber-500/5 dark:to-orange-500/5 ${fullRecipe?.image ? 'hidden fallback-text' : ''}`}>
                          <div className="w-12 h-12 rounded-full bg-white/50 dark:bg-black/20 shadow-sm flex items-center justify-center mb-2 backdrop-blur-sm border border-white/20 dark:border-white/5">
                            <UtensilsCrossed className="w-6 h-6 text-amber-600/60 dark:text-amber-400/50" />
                          </div>
                          <span className="font-serif text-amber-700/60 dark:text-amber-300/50 font-medium tracking-wide text-xs px-4 text-center line-clamp-1">{stat.title || 'Recipe'}</span>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                          <h3 className="text-white font-bold font-serif text-lg leading-tight">{stat.title}</h3>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-amber-600 dark:text-amber-400">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="font-bold text-sm">{avg}</span>
                            <span className="text-xs opacity-70">({stat.count})</span>
                          </div>
                        </div>

                        {latestComment && (
                          <div className="bg-theme-primary p-3 rounded-lg mb-4 border border-theme">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-4 h-4 rounded-full bg-[var(--accent-color)] text-[8px] text-white flex items-center justify-center">
                                {(latestComment && latestComment.userName) ? String(latestComment.userName).charAt(0) : '?'}
                              </div>
                              <span className="text-sm font-bold text-theme-secondary opacity-80">{latestComment.userName}</span>
                            </div>
                            <p className="text-sm text-theme-secondary italic line-clamp-2">"{latestComment.comment}"</p>
                          </div>
                        )}
                        
                        {/* Quick inline star rating */}
                        <div className="flex items-center gap-1 mb-3" onClick={(e) => e.stopPropagation()}>
                          <span className="text-sm text-theme-secondary opacity-60 mr-1">Rate:</span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRateRecipe({
                                  id: Date.now().toString(),
                                  recipeTitle: stat.title,
                                  rating: star,
                                  comment: '',
                                  userName: user?.name || 'User',
                                  userAvatar: user?.avatar,
                                  recipe: fullRecipe ?? undefined
                                });
                              }}
                              className="text-amber-400 hover:text-amber-500 transition-colors"
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (fullRecipe) {
                                onAddToPlan(fullRecipe);
                              } else {
                                const mockRecipe: StructuredRecipe = {
                                  title: stat.title,
                                  description: 'Community favorite',
                                  ingredients: ['Full recipe not available in this rating. Please save it first.'],
                                  instructions: ['Full recipe not available in this rating. Please save it first.'],
                                  cookTime: 'N/A'
                                };
                                onAddToPlan(mockRecipe);
                              }
                            }}
                            className="flex-1 py-2 bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[var(--accent-color)] hover:text-white transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Add to Schedule
                          </button>

                          {onSaveRecipe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fullRecipe) {
                                  onSaveRecipe(sanitizeRecipeForSave(fullRecipe));
                                } else {
                                  const mockRecipe: StructuredRecipe = {
                                    title: stat.title,
                                    description: 'Community favorite',
                                    ingredients: ['Full recipe not available in this rating. Please save it first.'],
                                    instructions: ['Full recipe not available in this rating. Please save it first.'],
                                    cookTime: 'N/A'
                                  };
                                  onSaveRecipe(sanitizeRecipeForSave(mockRecipe));
                                }
                              }}
                              className="py-2 px-3 bg-theme-primary border border-theme rounded-lg text-sm font-semibold hover:bg-theme-secondary transition-colors"
                            >
                              Save
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedRecipes.length > 5 && (
                  <div className="flex justify-center mt-4">
                    <button onClick={() => setShowAll(prev => !prev)} className="px-4 py-2 rounded bg-[var(--accent-color)] text-white text-sm font-bold shadow hover:opacity-90 transition-opacity">
                      {showAll ? 'Show Less' : `Show More (${sortedRecipes.length - 5})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ────────────────── SUBTAB 2: PANTRY SCORE LEADERBOARD ────────────────── */}
      {subTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-serif font-bold text-theme-secondary flex items-center justify-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" /> Pantry Challenge
            </h2>
            <p className="text-theme-secondary opacity-60 text-sm mt-1">Keep a healthy, waste-free pantry and compete</p>
          </div>

          {!optedIn ? (
            /* Leaderboard Onboarding On-ramp */
            <div className="bg-gradient-to-br from-amber-500/10 via-theme-secondary to-orange-500/5 border border-theme rounded-2xl p-6 shadow-md space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                  <Sparkles className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-theme-primary">Join the Leaderboard!</h3>
                <p className="text-sm text-theme-secondary opacity-80 max-w-sm mx-auto">
                  Compete with family, friends, and the community to maintain the freshest pantry and reduce kitchen waste.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm text-theme-secondary">
                <div className="flex items-start gap-3 bg-theme-primary/40 p-3 rounded-lg border border-theme">
                  <span className="text-lg">📈</span>
                  <div>
                    <strong className="text-theme-primary">Real-time Ranking</strong>
                    <p className="text-xs opacity-70">Your rank shifts automatically when your Pantry Health Score changes!</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-theme-primary/40 p-3 rounded-lg border border-theme">
                  <span className="text-lg">🔥</span>
                  <div>
                    <strong className="text-theme-primary">Show off Streaks</strong>
                    <p className="text-xs opacity-70">Log consecutive cooking days to boost your standing and show your dedication.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-theme-primary/40 p-3 rounded-lg border border-theme">
                  <span className="text-lg">🔒</span>
                  <div>
                    <strong className="text-theme-primary">Privacy First</strong>
                    <p className="text-xs opacity-70">Anonymous mode lets you rank by score without sharing your real name.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleJoinLeaderboard} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="leaderboard-name" className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
                    Your Leaderboard Display Name
                  </label>
                  <input
                    id="leaderboard-name"
                    type="text"
                    required
                    disabled={isAnonymous}
                    value={isAnonymous ? 'Pantry Champ' : leaderboardName}
                    onChange={(e) => setLeaderboardName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-theme bg-theme-primary text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] disabled:opacity-50 transition-all"
                    placeholder="Enter an alias..."
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer py-1 select-none">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-theme bg-theme-primary text-[var(--accent-color)] focus:ring-[var(--accent-color)] h-4 w-4"
                  />
                  <span className="text-xs text-theme-secondary font-medium">
                    Participate anonymously (renders as "Pantry Champ")
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full py-3 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" /> Let's Compete!
                </button>
              </form>
            </div>
          ) : (
            /* Active Leaderboard Dashboard */
            <div className="space-y-6">
              {/* Sticky Top User Summary */}
              <div className="bg-theme-secondary border border-theme rounded-2xl p-4 shadow-md flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-color)]/5 rounded-full translate-x-12 -translate-y-12 blur-xl pointer-events-none"></div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center relative">
                    <span className="text-[10px] uppercase font-black text-amber-600 tracking-wider">Rank</span>
                    <span className="text-2xl font-black text-amber-600">#{userRank}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-theme-primary truncate max-w-[150px]">
                      {isAnonymous ? 'Pantry Champ (You)' : `${leaderboardName} (You)`}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-theme-secondary mt-1">
                      <span className="flex items-center gap-1 font-semibold">
                        🏆 {userScore}/100
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        🔥 {userStreak}d
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        🎖️ {unlockedBadgesCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct CTA to In-App Weekly Waste Report Summary */}
                <button
                  onClick={() => setShowWasteReport(true)}
                  className="px-3 py-2 bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20 border border-[var(--accent-color)]/30 text-[var(--accent-color)] text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
                >
                  <TrendingUp className="w-4 h-4" /> Waste Report
                </button>
              </div>

              {/* Your Pantry Health — real card for the signed-in user's own entry (peer rows are simulated data) */}
              {leaderboardType === 'individual' && inventory.length >= 3 && (
                <PantryHealthScore
                  inventory={inventory}
                  variant="compact"
                  onExpand={() => setShowHealthDetail(true)}
                />
              )}

              {/* Toggles bar */}
              <div className="flex items-center justify-between gap-4">
                {/* Individual vs Household segment */}
                <div className="flex bg-theme-primary rounded-lg p-0.5 border border-theme shrink-0">
                  <button
                    onClick={() => setLeaderboardType('individual')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                      leaderboardType === 'individual'
                        ? 'bg-theme-secondary text-theme-primary shadow-sm'
                        : 'text-theme-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 inline mr-1" /> Me
                  </button>
                  <button
                    onClick={() => setLeaderboardType('household')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                      leaderboardType === 'household'
                        ? 'bg-theme-secondary text-theme-primary shadow-sm'
                        : 'text-theme-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 inline mr-1" /> Home
                  </button>
                </div>

                {/* Weekly vs Monthly segment */}
                <div className="flex bg-theme-primary rounded-lg p-0.5 border border-theme shrink-0">
                  <button
                    onClick={() => setLeaderboardTimeframe('weekly')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                      leaderboardTimeframe === 'weekly'
                        ? 'bg-theme-secondary text-theme-primary shadow-sm'
                        : 'text-theme-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setLeaderboardTimeframe('monthly')}
                    className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                      leaderboardTimeframe === 'monthly'
                        ? 'bg-theme-secondary text-theme-primary shadow-sm'
                        : 'text-theme-secondary opacity-60 hover:opacity-100'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              {/* Rankings List */}
              <div className="bg-theme-secondary border border-theme rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-theme">
                  {leaderboardData.map((entry) => (
                    <div
                      key={entry.name}
                      className={`flex items-center justify-between p-4 transition-colors ${
                        entry.isUser ? 'bg-[var(--accent-color)]/5 border-l-4 border-l-[var(--accent-color)]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank placement indicators */}
                        <div className="w-7 flex-shrink-0 text-center">
                          {entry.rank === 1 ? (
                            <span className="text-xl">🥇</span>
                          ) : entry.rank === 2 ? (
                            <span className="text-xl">🥈</span>
                          ) : entry.rank === 3 ? (
                            <span className="text-xl">🥉</span>
                          ) : (
                            <span className="text-sm font-black text-theme-secondary opacity-50">
                              {entry.rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar representation */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          entry.isUser 
                            ? 'bg-[var(--accent-color)] text-white' 
                            : entry.isHousehold 
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' 
                            : 'bg-theme-primary text-theme-secondary border border-theme'
                        }`}>
                          {entry.isHousehold ? (
                            <Users className="w-5 h-5" />
                          ) : (
                            entry.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Entry Name details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold truncate ${entry.isUser ? 'text-theme-primary' : 'text-theme-primary opacity-90'}`}>
                              {entry.name}
                            </span>
                            {entry.isHousehold && (
                              <span className="text-[9px] font-extrabold uppercase px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 tracking-wider">
                                Group
                              </span>
                            )}
                            {entry.isRealMember && (
                              <span className="text-[9px] font-extrabold uppercase px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 tracking-wider">
                                Household
                              </span>
                            )}
                          </div>
                          {/* Subtitles: streak info */}
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-theme-secondary opacity-60">
                            {entry.streak !== null && entry.streak > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Flame className="w-3.5 h-3.5 text-orange-500 fill-current" /> {entry.streak}d streak
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              🎖️ {entry.badges === null ? '—' : entry.badges} Badges
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Hand: score pill */}
                      <div className="flex items-center gap-1">
                        <div className="text-right">
                          <div className="text-sm font-black text-theme-primary">{entry.score}</div>
                          <div className="text-[9px] text-theme-secondary opacity-60 uppercase font-bold tracking-wider">Score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opt-out Option link */}
              <div className="text-center">
                <button
                  onClick={handleLeaveLeaderboard}
                  className="text-xs text-theme-secondary opacity-50 hover:opacity-100 transition-opacity hover:underline"
                >
                  Leave Leaderboard / Adjust Privacy settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── SUBTAB 3: ACHIEVEMENT BADGES SYSTEM ────────────────── */}
      {subTab === 'achievements' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-serif font-bold text-theme-secondary flex items-center justify-center gap-2">
              <Award className="w-7 h-7 text-[var(--accent-color)]" /> Achievements
            </h2>
            <p className="text-theme-secondary opacity-60 text-sm mt-1">
              Complete milestones and unlock gamified badges ({unlockedBadgesCount} / {achievementsList.length})
            </p>
          </div>

          {/* Relocated Setup Checklist Card */}
          {!isChecklistDismissed && completedChecklistCount < 5 && (
            <div className="bg-theme-secondary rounded-2xl border border-theme shadow-lg overflow-hidden transition-all duration-300">
              {/* Header */}
              <div 
                onClick={() => setIsChecklistCollapsed(c => !c)}
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-theme-primary/5 transition-colors select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-gradient-to-tr from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 rounded-lg flex items-center justify-center text-[var(--accent-color)] flex-shrink-0">
                    🍳
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-theme-primary text-sm sm:text-base truncate">Stock & Spoon Setup Checklist</h3>
                    <p className="text-xs text-theme-secondary opacity-75 truncate">
                      {completedChecklistCount === 5 
                        ? '🎉 Setup complete! You are ready to master your kitchen.' 
                        : `${completedChecklistCount} of 5 steps completed`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  {/* Progress Bar (mini, shown when collapsed) */}
                  {isChecklistCollapsed && completedChecklistCount < 5 && (
                    <div className="w-16 bg-theme rounded-full h-1.5 hidden sm:block">
                      <div 
                        className="bg-[var(--accent-color)] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(completedChecklistCount / 5) * 100}%` }}
                      />
                    </div>
                  )}
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsChecklistCollapsed(c => !c); }}
                    className="p-1 hover:bg-theme rounded text-theme-secondary hover:text-theme-primary transition-colors"
                    aria-label={isChecklistCollapsed ? 'Expand checklist' : 'Collapse checklist'}
                  >
                    {isChecklistCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); dismissChecklist(); }}
                    className="p-1 hover:bg-theme rounded text-theme-secondary hover:text-theme-primary transition-colors"
                    aria-label="Dismiss checklist permanently"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {!isChecklistCollapsed && (
                <div className="px-5 pb-5 pt-2 border-t border-theme/40 bg-theme-primary/5">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-theme-secondary font-medium mb-1">
                      <span>Activation Progress</span>
                      <span>{Math.round((completedChecklistCount / 5) * 100)}%</span>
                    </div>
                    <div className="w-full bg-theme rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[var(--accent-color)] to-[var(--accent-color)]/80 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(completedChecklistCount / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps List */}
                  <div className="space-y-3.5">
                    {checklistSteps.map(step => (
                      <div 
                        key={step.id} 
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                          step.isCompleted 
                            ? 'bg-green-500/5 border-green-500/10 opacity-75' 
                            : 'bg-theme-secondary/30 border-theme hover:border-theme-primary/20'
                        }`}
                      >
                        <button 
                          disabled={step.isCompleted}
                          onClick={step.action}
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                            step.isCompleted 
                              ? 'bg-green-500 border-green-500 text-white shadow-sm' 
                              : 'border-theme-secondary hover:border-[var(--accent-color)]'
                          }`}
                          aria-label={step.isCompleted ? `${step.label} (Completed)` : `Start ${step.label}`}
                        >
                          {step.isCompleted && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs sm:text-sm font-bold leading-tight ${step.isCompleted ? 'text-theme-primary/80 line-through' : 'text-theme-primary'}`}>
                            {step.label}
                          </p>
                          <p className="text-[10px] sm:text-xs text-theme-secondary opacity-80 mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>

                        {!step.isCompleted && (
                          <button
                            onClick={step.action}
                            className="shrink-0 px-2.5 py-1 bg-theme-primary text-theme-secondary hover:bg-theme-secondary border border-theme text-[10px] sm:text-xs font-semibold rounded-lg transition-all shadow-sm active:scale-95 ml-2"
                          >
                            {step.actionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Badges Grid */}
          <div className="grid grid-cols-2 gap-4">
            {achievementsList.map((badge) => (
              <div
                key={badge.id}
                onClick={() => handleBadgeClick(badge)}
                className={`bg-theme-secondary border rounded-2xl p-4 flex flex-col items-center justify-between text-center shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                  badge.isUnlocked
                    ? 'border-[var(--accent-color)]/30 hover:scale-[1.03]'
                    : 'border-theme opacity-60'
                }`}
              >
                {/* Unlock glow effect */}
                {badge.isUnlocked && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-color)]/2 to-transparent pointer-events-none"></div>
                )}

                {/* Badge Icon circle */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-inner mb-3 relative ${
                  badge.isUnlocked
                    ? `bg-gradient-to-br ${badge.color} text-white shadow-lg`
                    : 'bg-theme-primary text-gray-400 border border-theme grayscale'
                }`}>
                  {badge.icon}
                  {/* Lock Overlay */}
                  {!badge.isUnlocked && (
                    <div className="absolute -bottom-1 -right-1 bg-theme-secondary border border-theme rounded-full p-1 shadow-sm">
                      <Lock className="w-3.5 h-3.5 text-theme-secondary opacity-70" />
                    </div>
                  )}
                  {/* Unlock Sparkle */}
                  {badge.isUnlocked && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 shadow">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-1 w-full">
                  <h4 className="font-bold text-sm text-theme-primary truncate">{badge.title}</h4>
                  <p className="text-[11px] text-theme-secondary opacity-60 line-clamp-2 leading-tight min-h-[2rem]">
                    {badge.description}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full mt-4 space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-theme-secondary opacity-65">
                    <span>Progress</span>
                    <span>
                      {badge.currentValue}/{badge.targetValue} {badge.unit}
                    </span>
                  </div>
                  <ProgressBar
                    value={badge.currentValue}
                    max={badge.targetValue}
                    colorMode={badge.isUnlocked ? 'accent' : 'neutral'}
                    size="xs"
                  />
                </div>

                {/* Unlocked stamp */}
                {badge.isUnlocked && (
                  <div className="mt-2.5 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-0.5">
                    <CheckCircle className="w-3 h-3 fill-current" /> Unlocked!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────── POPUP MODAL: ACHIEVEMENT BADGE DETAIL ────────────────── */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-theme-secondary border border-theme rounded-3xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-secondary hover:opacity-80 transition-opacity font-extrabold"
              aria-label="Close details"
            >
              ×
            </button>

            {/* Badge Large Display */}
            <div className="flex flex-col items-center text-center space-y-4 pt-4">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl relative ${
                selectedBadge.isUnlocked
                  ? `bg-gradient-to-br ${selectedBadge.color} text-white ring-4 ring-[var(--accent-color)]/20`
                  : 'bg-theme-primary text-gray-400 border-2 border-theme grayscale'
              }`}>
                {selectedBadge.icon}
                {!selectedBadge.isUnlocked && (
                  <div className="absolute inset-0 bg-black/5 rounded-full flex items-center justify-center">
                    <Lock className="w-8 h-8 text-white/40" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full ${
                  selectedBadge.isUnlocked 
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-theme-primary text-theme-secondary'
                }`}>
                  {selectedBadge.isUnlocked ? 'Completed' : 'Locked'}
                </span>
                <h3 className="text-2xl font-serif font-black text-theme-primary pt-1">{selectedBadge.title}</h3>
              </div>

              <p className="text-sm text-theme-secondary opacity-80 leading-relaxed max-w-xs">
                {selectedBadge.description}
              </p>

              {/* Progress Detail */}
              <div className="w-full bg-theme-primary/60 border border-theme rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs font-bold text-theme-secondary">
                  <span>Current Progress</span>
                  <span>
                    {selectedBadge.currentValue} / {selectedBadge.targetValue} {selectedBadge.unit}
                  </span>
                </div>
                <ProgressBar
                  value={selectedBadge.currentValue}
                  max={selectedBadge.targetValue}
                  colorMode={selectedBadge.isUnlocked ? 'success' : 'accent'}
                  size="sm"
                />
                <p className="text-xs text-theme-secondary italic opacity-75 pt-1">
                  <strong>Tip:</strong> {selectedBadge.tip}
                </p>
              </div>

              {/* Share CTA Button */}
              {selectedBadge.isUnlocked ? (
                <button
                  onClick={() => {
                    triggerCelebration();
                    if (navigator.share) {
                      navigator.share({
                        title: `I unlocked ${selectedBadge.title}!`,
                        text: `I just earned the ${selectedBadge.title} badge on Stock & Spoon! My pantry score is ${userScore}/100. Can you beat me?`,
                        url: window.location.origin
                      }).catch(err => log.info('User cancelled sharing or sharing failed', { error: err }));
                    } else {
                      navigator.clipboard.writeText(`I just earned the ${selectedBadge.title} badge on Stock & Spoon! My pantry score is ${userScore}/100. Can you beat me?`);
                      alert('Share text copied to clipboard!');
                    }
                  }}
                  className="w-full py-3 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share Accomplishment
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedBadge(null);
                    if (selectedBadge.id === 'master_chef') setActiveTab(Tab.RECIPES);
                    else if (selectedBadge.id === 'meal_planner') setActiveTab(Tab.MEALS);
                    else setActiveTab(Tab.PANTRY);
                  }}
                  className="w-full py-3 bg-theme-primary border border-theme text-theme-primary hover:bg-theme-secondary font-bold rounded-xl transition-all"
                >
                  Work on this Badge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── POPUP MODAL: WEEKLY WASTE REPORT SUMMARY ────────────────── */}
      {/* Pantry Health Detail Sheet */}
      <BottomSheet
        isOpen={showHealthDetail}
        onClose={() => setShowHealthDetail(false)}
        title="Pantry Health"
        subtitle="Full breakdown of your score"
        snap="auto"
      >
        <BottomSheet.Body className="p-4">
          <PantryHealthScore inventory={inventory} variant="full" />
        </BottomSheet.Body>
      </BottomSheet>

      {showWasteReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-theme-secondary border border-theme rounded-3xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            <button
              onClick={() => setShowWasteReport(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-secondary hover:opacity-80 transition-opacity font-extrabold"
              aria-label="Close report"
            >
              ×
            </button>

            {/* Header */}
            <div className="space-y-1 mb-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2 border border-green-500/20">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-serif font-black text-theme-primary">Weekly Waste Report</h3>
              <p className="text-xs text-theme-secondary opacity-60">Calculated for the last 7 days</p>
            </div>

            {/* Waste Score Gauge */}
            <div className="bg-theme-primary/50 border border-theme rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-theme-secondary tracking-widest">Sustainability Score</span>
                  <div className="text-3xl font-black text-emerald-500">
                    {Math.max(40, 100 - expiredCount * 6)}%
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-theme-secondary tracking-widest">Efficiency Grade</span>
                  <div className="text-lg font-black text-theme-primary">
                    {userScore >= 90 ? 'A+' : userScore >= 80 ? 'A' : userScore >= 70 ? 'B' : 'C'}
                  </div>
                </div>
              </div>

              {/* Progress visual */}
              <ProgressBar
                value={Math.max(40, 100 - expiredCount * 6)}
                colorMode="success"
                size="sm"
              />

              {/* Three detailed statistics columns */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-theme">
                <div className="text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-theme-secondary opacity-60 uppercase">Used</span>
                  <div className="text-sm font-extrabold text-theme-primary">
                    {inventory.length > 0 ? Math.max(2, inventory.length * 2 - expiredCount) : 0}
                  </div>
                </div>
                <div className="text-center space-y-0.5 border-x border-theme">
                  <span className="text-[10px] font-bold text-theme-secondary opacity-60 uppercase">Wasted</span>
                  <div className="text-sm font-extrabold text-red-500">
                    {expiredCount}
                  </div>
                </div>
                <div className="text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-theme-secondary opacity-60 uppercase">Saved</span>
                  <div className="text-sm font-extrabold text-emerald-500 flex items-center justify-center gap-0.5">
                    <DollarSign className="w-3 h-3" />
                    {(Math.max(0, inventory.length * 2 - expiredCount) * 3.5).toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insight Tip Box */}
            <div className="my-5 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3 text-xs text-theme-secondary leading-relaxed">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-theme-primary">Smart Food Waste Tip:</strong>
                {expiredCount > 0 ? (
                  <p className="mt-0.5">
                    You have {expiredCount} expired items. Discarding food costs an estimated ${(expiredCount * 4.5).toFixed(2)} this week. Next time, move items nearing expiry to the **Freezer** to extend their shelf life USDA-safely!
                  </p>
                ) : (
                  <p className="mt-0.5">
                    Amazing job! You have zero expired items in your pantry. By consuming everything in time, you've saved an estimated ${(inventory.length * 3.5).toFixed(2)} and reduced carbon footprint this week. Keep it up!
                  </p>
                )}
              </div>
            </div>

            {/* OK Button */}
            <button
              onClick={() => setShowWasteReport(false)}
              className="w-full py-3 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Great, thanks!
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── EMBEDDED DETAILS DIALOG: COMMUNITY RECIPES ────────────────── */}
      {showModal && selectedRecipe && (() => {
        const recipeFromComment = findRecipeForStat(selectedRecipe);
        const structured: StructuredRecipe = recipeFromComment
          ? recipeFromComment
          : {
              title: selectedRecipe.title,
              description: 'Community favorite',
              ingredients: ['Full recipe not available in this rating. Please save it first.'],
              instructions: ['Full recipe not available in this rating. Please save it first.'],
              cookTime: 'N/A'
            };
        return (
          <RecipeModal
            recipe={structured}
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onAddToPlan={(r) => { onAddToPlan(r); }}
            onSaveRecipe={(r) => onSaveRecipe?.(r)}
            onRate={onRateRecipe}
            showSaveButton={true}
            showMarkAsMade={false}
            showAddToPlan={true}
            user={user}
          />
        );
      })()}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />
    </div>
  );
};

export const Community = React.memo(CommunityComponent);