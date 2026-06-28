import React, { useState, useEffect } from 'react';
import { LeftoverService } from '../../services/leftoverService';
import FoodWasteAnalyticsService, { FoodWasteAnalytics } from '../../services/foodWasteAnalyticsService';
import { InventoryCacheService } from '../../services/inventoryCacheService';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Trash2, 
  ArrowLeft, 
  MessageSquare, 
  Share2, 
  Calendar, 
  ShoppingBasket, 
  Utensils, 
  PiggyBank, 
  Award 
} from 'lucide-react';
import { log } from '../../services/logService';

interface LeftoverAnalyticsProps {
  householdId?: string;
  userId?: string;
}

interface LeftoverSavings {
  totalServingsConsumed: number;
  totalServingsWasted: number;
  estimatedValueSaved: number;
  estimatedValueWasted: number;
  mealsReplaced: number;
  wasteReductionPercentage: number;
  // Food waste analytics
  totalItemsDisposed: number;
  itemsThrownAway: number;
  itemsCooked: number;
  itemsRemoved: number;
  averageDaysExpired: number;
  totalWasteValue: number;
  // Good news metrics
  moneySaved: number;
}

// Inline custom SVGs for app store badges
const PlayStoreIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M5,2.56C4.85,2.56 4.7,2.6 4.58,2.69L13.88,12L4.58,21.31C4.7,21.4 4.85,21.44 5,21.44C5.23,21.44 5.46,21.36 5.66,21.21L19.44,13.29C19.8,13.08 20,12.56 20,12C20,11.44 19.8,10.92 19.44,10.71L5.66,2.79C5.46,2.64 5.23,2.56 5,2.56M3,3.31V20.69L12.44,12L3,3.31Z" />
  </svg>
);

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
  </svg>
);

export const LeftoverAnalytics: React.FC<LeftoverAnalyticsProps> = ({ householdId, userId }) => {
  const [analytics, setAnalytics] = useState<LeftoverSavings | null>(null);
  const [foodWasteAnalytics, setFoodWasteAnalytics] = useState<FoodWasteAnalytics | null>(null);
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'all'>('week');
  const [totalItemsInPantry, setTotalItemsInPantry] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch food waste analytics
        const foodWasteData = await FoodWasteAnalyticsService.getAnalytics(householdId, userId);
        setFoodWasteAnalytics(foodWasteData);

        // Fetch inventory count
        if (userId === 'guest') {
          const localInventory = localStorage.getItem('guest_inventory');
          if (localInventory) {
            try {
              const parsed = JSON.parse(localInventory);
              setTotalItemsInPantry(parsed.length);
            } catch {
              setTotalItemsInPantry(0);
            }
          }
        } else {
          try {
            const inventoryData = await InventoryCacheService.getCachedInventory(householdId, userId);
            setTotalItemsInPantry(inventoryData.length);
          } catch {
            setTotalItemsInPantry(0);
          }
        }

        // Calculate leftover analytics
        await calculateLeftoverAnalytics(foodWasteData, timePeriod);
      } catch (err) {
        log.error('Error fetching analytics', { error: err }, 'LeftoverAnalytics');
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [householdId, userId]);

  const calculateLeftoverAnalytics = async (currentFoodWasteAnalytics?: FoodWasteAnalytics | null, period: 'week' | 'month' | 'all' = 'week') => {
    try {
      // Get all current leftovers
      const leftovers = await LeftoverService.getLeftovers(householdId, userId);

      // Calculate based on original quantity_estimate vs current remaining servings
      const totalServingsConsumed = leftovers.reduce((sum, leftover) => {
        const originalServings = Number(leftover.quantity_estimate) || leftover.leftoverMeta?.servings || 1;
        const consumedServings = originalServings - (leftover.leftoverMeta?.servings || 0);
        return sum + Math.max(0, consumedServings);
      }, 0);

      const totalServingsWasted = leftovers.reduce((sum, leftover) => {
        // Assume some percentage of leftovers expire and get wasted
        // This is a simplified calculation
        const daysOld = leftover.dateAdded ? Math.floor((Date.now() - new Date(leftover.dateAdded).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        if (daysOld > 7) { // Assume leftovers older than 7 days have higher waste risk
          return sum + (leftover.leftoverMeta?.servings || 1) * 0.3; // 30% waste rate
        }
        return sum;
      }, 0);

      // Estimate value based on typical food costs
      const avgCostPerServing = 2.50; // $2.50 per serving average
      const estimatedValueSaved = totalServingsConsumed * avgCostPerServing;
      const estimatedValueWasted = totalServingsWasted * avgCostPerServing;

      // Estimate meals replaced (assuming 2-3 servings per meal)
      const mealsReplaced = Math.floor(totalServingsConsumed / 2.5);

      // Calculate waste reduction (compared to not using leftovers)
      const potentialWasteWithoutLeftovers = leftovers.length * 2; // Assume 2 servings wasted per leftover if not used
      const actualWaste = totalServingsWasted;
      const wasteReductionPercentage = potentialWasteWithoutLeftovers > 0
        ? Math.max(0, ((potentialWasteWithoutLeftovers - actualWaste) / potentialWasteWithoutLeftovers) * 100)
        : 0;

      const wasteData = currentFoodWasteAnalytics !== undefined ? currentFoodWasteAnalytics : foodWasteAnalytics;

      // Filter disposal history by time period
      let filteredHistory = wasteData?.disposalHistory || [];
      const now = new Date();
      if (period === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredHistory = filteredHistory.filter(r => r.disposalDate >= oneWeekAgo);
      } else if (period === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredHistory = filteredHistory.filter(r => r.disposalDate >= oneMonthAgo);
      }

      const totalItemsDisposed = filteredHistory.length;
      const itemsThrownAway = filteredHistory.filter(r => r.disposalReason === 'thrown_away').length;
      const itemsCooked = filteredHistory.filter(r => r.disposalReason === 'cooked').length;
      const itemsRemoved = filteredHistory.filter(r => r.disposalReason === 'remove').length;
      const averageDaysExpired = filteredHistory.length > 0
        ? filteredHistory.reduce((sum, r) => sum + r.daysExpired, 0) / filteredHistory.length
        : 0;
      const totalWasteValue = filteredHistory.reduce((sum, r) => sum + (r.estimatedValue || 0), 0);

      // Money Saved = Value of items cooked instead of wasted + estimated value saved from leftovers
      const moneySavedFromCooking = filteredHistory
        .filter(r => r.disposalReason === 'cooked')
        .reduce((sum, r) => sum + (r.estimatedValue || 2.50), 0);
      const moneySaved = moneySavedFromCooking + estimatedValueSaved;

      setAnalytics({
        totalServingsConsumed,
        totalServingsWasted,
        estimatedValueSaved,
        estimatedValueWasted,
        mealsReplaced,
        wasteReductionPercentage,
        // Include food waste analytics
        totalItemsDisposed,
        itemsThrownAway,
        itemsCooked,
        itemsRemoved,
        averageDaysExpired,
        totalWasteValue,
        moneySaved
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate analytics');
    }
  };

  const getDateRangeLabel = (period: 'week' | 'month' | 'all') => {
    if (period === 'all') return 'All Time';
    const now = new Date();
    const days = period === 'week' ? 7 : 30;
    const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const formatDate = (d: Date) => {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    
    return `Last ${days} days (${formatDate(pastDate)} - ${formatDate(now)})`;
  };

  const handleShare = async () => {
    if (!analytics) return;
    const totalMoneySaved = analytics.moneySaved;
    const itemsCooked = analytics.itemsCooked + analytics.mealsReplaced;

    const shareText = `I have ${totalItemsInPantry} pantry items, cooked ${itemsCooked} smart meals, and saved $${totalMoneySaved.toFixed(2)} on food waste using Stock & Spoon! Join me in reducing food waste!`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'My Stock & Spoon Achievements',
          text: shareText,
          url: 'https://stockandspoon.com',
          dialogTitle: 'Share Achievements'
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'My Stock & Spoon Achievements',
          text: shareText,
          url: window.location.origin
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Achievements copied to clipboard!');
      }
    } catch (err) {
      log.error('Error sharing achievements', { error: err }, 'LeftoverAnalytics');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-400">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center p-4 text-theme-secondary">
        <p>No leftover data available</p>
      </div>
    );
  }

  const itemsCookedCount = analytics.itemsCooked + analytics.mealsReplaced;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-green-400">Meals Saved</h3>
          </div>
          <p className="text-2xl font-bold text-white">{analytics.mealsReplaced}</p>
          <p className="text-sm text-green-300">meals replaced with leftovers</p>
        </div>

        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-400">Waste Reduced</h3>
          </div>
          <p className="text-2xl font-bold text-white">{analytics.wasteReductionPercentage.toFixed(0)}%</p>
          <p className="text-sm text-red-300">less food waste</p>
        </div>
      </div>

      {/* Achievements CTA Button */}
      <button
        onClick={() => setShowAchievements(true)}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl p-4 shadow-md flex items-center justify-between transition-all transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-yellow-200 animate-pulse" />
          <div className="text-left">
            <p className="font-bold text-sm text-white">View & Share Achievements</p>
            <p className="text-xs text-orange-100 font-medium">See your positive kitchen impact!</p>
          </div>
        </div>
        <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          View
        </span>
      </button>

      {/* Detailed Metrics */}
      <div className="space-y-4">
        <div className="bg-theme-secondary rounded-lg p-4 border border-theme">
          <h4 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Impact
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-400">Value Saved (Est.):</span>
              <span className="font-semibold text-green-400">${analytics.estimatedValueSaved.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400 flex items-center gap-1">
                Potential Waste (Est.):
                <span className="text-xs text-red-400/70" title="Assumes a 30% waste rate for leftovers older than 7 days">(30% over 7d old)</span>
              </span>
              <span className="font-semibold text-red-400">${analytics.estimatedValueWasted.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-theme pt-2">
              <span className="text-theme-primary">Net Savings (Est.):</span>
              <span className="font-semibold text-theme-primary">
                ${(analytics.estimatedValueSaved - analytics.estimatedValueWasted).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-theme-secondary rounded-lg p-4 border border-theme">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-theme pb-2">
            <h4 className="font-semibold text-theme-primary flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Food Waste Analytics
            </h4>
            {/* Time Period Selector */}
            <div className="flex bg-theme-primary p-0.5 rounded-md border border-theme self-start sm:self-auto">
              {(['week', 'month', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setTimePeriod(period);
                    calculateLeftoverAnalytics(foodWasteAnalytics, period);
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all uppercase ${
                    timePeriod === period
                      ? 'bg-[var(--accent-color)] text-white shadow'
                      : 'text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {period === 'week' ? '7 Days' : period === 'month' ? '30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Items Disposed:</span>
              <span className="font-semibold">{analytics.totalItemsDisposed}</span>
            </div>
            <div className="flex justify-between">
              <span>Thrown Away:</span>
              <span className="font-semibold text-red-400">{analytics.itemsThrownAway}</span>
            </div>
            <div className="flex justify-between">
              <span>Cooked With:</span>
              <span className="font-semibold text-green-400">{analytics.itemsCooked}</span>
            </div>
            <div className="flex justify-between">
              <span>Just Removed:</span>
              <span className="font-semibold text-yellow-400">{analytics.itemsRemoved}</span>
            </div>
            <div className="flex justify-between border-t border-theme pt-2">
              <span>Avg Days Expired:</span>
              <span className="font-semibold">{analytics.averageDaysExpired.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Waste Value:</span>
              <span className="font-semibold text-red-400">${analytics.totalWasteValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-theme-secondary">
        <p>Analytics based on current leftover data and disposal history</p>
        <p>Values are estimates (assuming a 30% waste rate for leftovers older than 7 days) and may vary based on actual food costs</p>
      </div>

      {/* Achievements Modal Overlay */}
      {showAchievements && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col animate-fade-in">
          {/* Header */}
          <div className="bg-[#e65100] text-white px-4 py-3.5 flex items-center justify-between shadow-md">
            <button 
              onClick={() => setShowAchievements(false)} 
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className="font-bold text-lg tracking-wide">Achievements</span>
            <div className="flex items-center gap-3">
              <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
              <button 
                onClick={handleShare}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-[#f8fafc] text-slate-800 p-6 space-y-6 pb-12">
            <div className="text-center space-y-2 mt-2">
              <h2 className="text-2xl font-black text-[#0f172a] leading-tight">Food Waste Data Updated!</h2>
              <p className="text-sm text-slate-500 font-semibold px-4">
                Check out how much money I've saved by reducing food waste!
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-bold mt-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{getDateRangeLabel(timePeriod)}</span>
              </div>
            </div>

            {/* Gradient Cards */}
            <div className="space-y-4 max-w-md mx-auto">
              {/* Card 1: Pantry Items */}
              <div className="bg-gradient-to-br from-[#ff5e62] to-[#ff9966] text-white rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 transform rotate-45" />
                <ShoppingBasket className="w-10 h-10 drop-shadow" />
                <span className="text-4xl font-black tracking-tight">{totalItemsInPantry}</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-lg">Pantry Items</h3>
                  <p className="text-xs text-white/80 font-medium">Currently in the kitchen</p>
                </div>
              </div>

              {/* Card 2: Smart Meals Cooked */}
              <div className="bg-gradient-to-br from-[#ec008c] to-[#fc6767] text-white rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 transform rotate-45" />
                <Utensils className="w-10 h-10 drop-shadow" />
                <span className="text-4xl font-black tracking-tight">{itemsCookedCount}</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-lg">Smart Meals Cooked</h3>
                  <p className="text-xs text-white/80 font-medium">Meals saved from waste</p>
                </div>
              </div>

              {/* Card 3: Money Saved */}
              <div className="bg-gradient-to-br from-[#11998e] to-[#38ef7d] text-white rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 transform rotate-45" />
                <PiggyBank className="w-10 h-10 drop-shadow" />
                <span className="text-4xl font-black tracking-tight">${analytics.moneySaved.toFixed(2)}</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-lg">Money Saved</h3>
                  <p className="text-xs text-white/80 font-medium">Through smart cooking</p>
                </div>
              </div>

              {/* CTA Card */}
              <div className="bg-gradient-to-br from-[#642b73] to-[#c6426e] text-white rounded-2xl p-6 shadow-lg text-center space-y-4 max-w-md mx-auto mt-6">
                <h3 className="text-lg font-black leading-snug">
                  Start Your Own Food Waste Reduction Journey Today!
                </h3>
                <p className="text-xs text-white/80 leading-relaxed font-medium">
                  Join hundreds of thousands of other users making a difference with the Stock & Spoon app.
                </p>
                
                <div className="flex items-center justify-center gap-3 pt-1">
                  {/* Google Play Button */}
                  <a 
                    href="https://play.google.com/store" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-black border border-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-slate-950 transition-all active:scale-95"
                  >
                    <PlayStoreIcon className="w-5 h-5 text-white" />
                    <div className="text-left">
                      <p className="text-[8px] uppercase tracking-wider text-white/60 font-semibold leading-none">Get it on</p>
                      <p className="text-[11px] text-white font-bold leading-tight">Google Play</p>
                    </div>
                  </a>

                  {/* App Store Button */}
                  <a 
                    href="https://www.apple.com/app-store" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-black border border-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-slate-950 transition-all active:scale-95"
                  >
                    <AppleIcon className="w-5 h-5 text-white" />
                    <div className="text-left">
                      <p className="text-[8px] uppercase tracking-wider text-white/60 font-semibold leading-none">Download on the</p>
                      <p className="text-[11px] text-white font-bold leading-tight">App Store</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};