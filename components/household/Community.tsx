import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { Tab } from '../../types/app';
import { ProgressBar, BottomSheet } from '../ui';
import { PantryHealthScore } from '../pantry/PantryHealthScore';
import {
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
import { StructuredRecipe } from '../../types';
import RecipeModal from '../recipes-meals/RecipeModal';
import { log } from '../../services/logService';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useCelebrationFireworks } from '../../hooks/useCelebrationFireworks';
import { useCommunityLeaderboard } from './useCommunityLeaderboard';
import { useCommunityAchievements } from './useCommunityAchievements';
import { useCommunityChecklist } from './useCommunityChecklist';
import { useCommunityRatings, RecipeStats } from './useCommunityRatings';
import { CommunityRecipesFeed, findRecipeForStat } from './CommunityRecipesFeed';

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

import { AchievementBadge } from '../../utils/achievementUtils';

const CommunityComponent: React.FC<CommunityProps> = ({ onAddToPlan, onSaveRecipe, user }) => {
  const app = useApp();
  const { isLoadingRatings, setLoadingRatingsComplete, inventory = [], savedRecipes = [], mealPlan = [], household = null } = app;
  const { setActiveTab, onRateRecipe, addToast } = useAppActions();
  const confirm = useConfirm();
  const toast = useToast();
  
  // Navigation & Toggle State
  const [subTab, setSubTab] = useState<'recipes' | 'leaderboard' | 'achievements'>('recipes');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeStats | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [showWasteReport, setShowWasteReport] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);

  const { canvasRef, triggerCelebration } = useCelebrationFireworks();

  const hasMealsPlanned = useMemo(() => {
    return mealPlan.some(day => (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0) > 0);
  }, [mealPlan]);

  // Live pantry-score stats + gamified achievement badges (F37: components/household/useCommunityAchievements.ts)
  const { userScore, userStreak, expiredCount, achievementsList, unlockedBadgesCount } = useCommunityAchievements({
    inventory,
    savedRecipes,
    household,
    hasMealsPlanned,
  });

  // Onboarding checklist tracking relocated to Social tab (F37: components/household/useCommunityChecklist.ts)
  const {
    checklistSteps,
    completedChecklistCount,
    isChecklistCollapsed,
    setIsChecklistCollapsed,
    isChecklistDismissed,
    dismissChecklist,
  } = useCommunityChecklist(inventory.length, setActiveTab);

  // Pantry-score leaderboard opt-in, cache sync, and rankings (F37: components/household/useCommunityLeaderboard.ts)
  const {
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
  } = useCommunityLeaderboard({ user, household, userScore, userStreak, unlockedBadgesCount, confirm });

  // Cached community-rated recipes + derived per-recipe stats (F37: components/household/useCommunityRatings.ts)
  const { localLoading, sortedRecipes } = useCommunityRatings(setLoadingRatingsComplete);

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

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Dynamic Tab Switcher */}
      <div className="sticky top-0 z-10 bg-theme-primary py-3 -mx-4 px-4 border-b border-theme/40 shadow-sm md:-mx-8 md:px-8">
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
        <CommunityRecipesFeed
          isLoadingRatings={isLoadingRatings}
          localLoading={localLoading}
          sortedRecipes={sortedRecipes}
          onOpenRecipeDetail={(stat) => { setSelectedRecipe(stat); setShowModal(true); }}
          onAddToPlan={onAddToPlan}
          onSaveRecipe={onSaveRecipe}
          onRateRecipe={onRateRecipe}
          user={user}
          setActiveTab={setActiveTab}
        />
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
                      toast.success('Share text copied to clipboard!');
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
        <BottomSheet.Body className="p-4 pb-safe">
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