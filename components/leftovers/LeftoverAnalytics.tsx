import React, { useState, useEffect } from 'react';
import { LeftoverService } from '../../services/leftoverService';
import FoodWasteAnalyticsService, { FoodWasteAnalytics } from '../../services/foodWasteAnalyticsService';
import { InventoryCacheService } from '../../services/inventoryCacheService';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useAppActions } from '../../contexts/AppActionsContext';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Trash2, 
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



const generateAchievementImage = (
  pantryCount: number,
  mealsCount: number,
  savings: number
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350; // Instagram portrait ratio (4:5)
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // 1. Background Gradient (Deep elegant dark slate with a subtle emerald glow)
    const bgGrad = ctx.createRadialGradient(540, 675, 100, 540, 675, 800);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1350);

    // Glow effect
    const glowGrad = ctx.createRadialGradient(540, 400, 50, 540, 400, 500);
    glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
    glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(540, 400, 500, 0, Math.PI * 2);
    ctx.fill();

    // 2. Branding & Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText('STOCK & SPOON', 540, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('My Sustainable Kitchen', 540, 200);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '30px sans-serif';
    ctx.fillText("Here's the positive impact I've made by planning meals:", 540, 270);

    // 3. Helper to draw rounded cards
    const drawCard = (
      y: number,
      title: string,
      value: string,
      description: string,
      accentColor: string,
      bgAccent: string
    ) => {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      const x = 140;
      const w = 800;
      const h = 200;
      const r = 24;
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = accentColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, 16, h, [r, 0, 0, r]);
      } else {
        ctx.rect(x, y, 16, h);
      }
      ctx.fill();

      ctx.fillStyle = bgAccent;
      ctx.beginPath();
      ctx.arc(240, y + 100, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText(value, 330, y + 70);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(title, 330, y + 115);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(description, 330, y + 155);
    };

    // Active Ingredients
    drawCard(
      360,
      'Active Ingredients',
      pantryCount.toString(),
      'Currently tracked and managed in my kitchen',
      '#f97316',
      'rgba(249, 115, 22, 0.15)'
    );

    // Waste-Free Meals
    drawCard(
      600,
      'Waste-Free Meals',
      mealsCount.toString(),
      'Delicious meals saved from going to waste',
      '#ec4899',
      'rgba(236, 72, 153, 0.15)'
    );

    // Eco Savings
    drawCard(
      840,
      'Eco Savings',
      `$${savings.toFixed(2)}`,
      'Estimated budget saved by preventing food waste',
      '#10b981',
      'rgba(16, 185, 129, 0.15)'
    );

    // 4. Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('Join the movement at stockandspoon.com', 540, 1150);

    ctx.fillStyle = '#64748b';
    ctx.font = '24px sans-serif';
    ctx.fillText('Preventing food waste, one meal at a time.', 540, 1210);

    resolve(canvas.toDataURL('image/png'));
  });
};

export const LeftoverAnalytics: React.FC<LeftoverAnalyticsProps> = ({ householdId, userId }) => {
  const { addToast } = useAppActions();
  const [analytics, setAnalytics] = useState<LeftoverSavings | null>(null);
  const [foodWasteAnalytics, setFoodWasteAnalytics] = useState<FoodWasteAnalytics | null>(null);
  const timePeriod = 'all';
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
        await calculateLeftoverAnalytics(foodWasteData);
      } catch (err) {
        log.error('Error fetching analytics', { error: err }, 'LeftoverAnalytics');
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [householdId, userId]);

  const calculateLeftoverAnalytics = async (currentFoodWasteAnalytics?: FoodWasteAnalytics | null) => {
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

      const totalItemsDisposed = wasteData?.totalItemsDisposed || 0;
      const itemsThrownAway = wasteData?.itemsByReason?.thrown_away || 0;
      const itemsCooked = wasteData?.itemsByReason?.cooked || 0;
      const itemsRemoved = wasteData?.itemsByReason?.remove || 0;
      const averageDaysExpired = wasteData?.averageDaysExpired || 0;
      const totalWasteValue = Math.max(0, (wasteData?.totalEstimatedValue || 0) - (wasteData?.totalCookedValue || 0));

      // Money Saved = Value of items cooked instead of wasted + estimated value saved from leftovers
      const moneySavedFromCooking = wasteData?.totalCookedValue || 0;
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

    const shareText = `I have ${totalItemsInPantry} active ingredients, cooked ${itemsCooked} waste-free meals, and saved $${totalMoneySaved.toFixed(2)} on food waste using Stock & Spoon!\n\nGet the app on Google Play: https://play.google.com/store/apps/details?id=com.smart.pantry`;

    try {
      addToast('Generating accomplishments card...', 'info', 2500);
      const dataUrl = await generateAchievementImage(totalItemsInPantry, itemsCooked, totalMoneySaved);
      if (!dataUrl) throw new Error('Failed to generate image');

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(',')[1];
        const fileName = `achievements_${Date.now()}.png`;

        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'My Stock & Spoon Impact',
          text: shareText,
          url: fileResult.uri,
          dialogTitle: 'Share Achievements'
        });
      } else if (navigator.share) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'achievements.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Stock & Spoon Impact',
            text: shareText,
            files: [file]
          });
        } else {
          await navigator.share({
            title: 'My Stock & Spoon Impact',
            text: shareText,
            url: window.location.origin
          });
        }
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'stock_and_spoon_impact.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('Accomplishments image downloaded! Description copied to clipboard.', 'success', 5000);
        await navigator.clipboard.writeText(shareText);
      }
    } catch (err) {
      log.error('Error sharing achievements', { error: err }, 'LeftoverAnalytics');
      addToast('Failed to share image. Copied text to clipboard instead.', 'info', 4000);
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        // Clipboard write failed or is unsupported
      }
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
            <span className="text-[10px] bg-theme-primary text-theme-secondary border border-theme px-2.5 py-1 rounded font-bold uppercase tracking-wider">
              All Time
            </span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-theme-secondary border border-theme rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slide-up relative">
            
            {/* Decorative background glows */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--accent-color)]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header with status-bar padding for Android/iOS */}
            <div 
              className="border-b border-theme px-6 pb-4 flex items-center justify-between relative z-10"
              style={{ paddingTop: 'calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1rem)' }}
            >
              <span className="font-bold text-lg text-theme-primary font-serif">My Kitchen Impact</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleShare}
                  className="p-2 hover:bg-theme-primary rounded-full transition-colors text-theme-secondary hover:text-theme-primary"
                  title="Share accomplishments"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowAchievements(false)} 
                  className="p-2 hover:bg-theme-primary rounded-full transition-colors text-theme-secondary hover:text-theme-primary font-bold text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-serif font-bold text-theme-primary">Sustainable Cooking Wins! 🎉</h2>
                <p className="text-sm text-theme-secondary opacity-80 px-2">
                  Here is the positive impact I've made by planning meals and reducing waste.
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-color)] font-semibold mt-1 bg-[var(--accent-color)]/10 px-2.5 py-1 rounded-full">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{getDateRangeLabel(timePeriod)}</span>
                </div>
              </div>

              {/* Grid of Stats */}
              <div className="grid grid-cols-1 gap-4">
                {/* Stat 1: Active Ingredients */}
                <div className="bg-theme-primary border border-theme rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--accent-color)]/35 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                    <ShoppingBasket className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-2xl font-black text-theme-primary block leading-none mb-1">{totalItemsInPantry}</span>
                    <h3 className="font-bold text-sm text-theme-primary">Active Ingredients</h3>
                    <p className="text-xs text-theme-secondary opacity-75">Currently tracked and managed in my kitchen</p>
                  </div>
                </div>

                {/* Stat 2: Waste-Free Meals */}
                <div className="bg-theme-primary border border-theme rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--accent-color)]/35 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/15 flex items-center justify-center text-pink-500 shrink-0">
                    <Utensils className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-2xl font-black text-theme-primary block leading-none mb-1">{itemsCookedCount}</span>
                    <h3 className="font-bold text-sm text-theme-primary">Waste-Free Meals</h3>
                    <p className="text-xs text-theme-secondary opacity-75">Delicious meals saved from going to waste</p>
                  </div>
                </div>

                {/* Stat 3: Eco Savings */}
                <div className="bg-theme-primary border border-theme rounded-2xl p-5 flex items-center gap-4 hover:border-[var(--accent-color)]/35 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500 shrink-0">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-2xl font-black text-theme-primary block leading-none mb-1">${analytics.moneySaved.toFixed(2)}</span>
                    <h3 className="font-bold text-sm text-theme-primary">Eco Savings</h3>
                    <p className="text-xs text-theme-secondary opacity-75">Estimated budget saved by preventing food waste</p>
                  </div>
                </div>
              </div>

              {/* Elegant Footer Branding */}
              <div className="text-center pt-4 border-t border-theme space-y-3">
                <p className="text-xs text-theme-secondary font-medium">
                  Cooking sustainably with <strong className="text-theme-primary">Stock & Spoon</strong>
                </p>
                <p className="text-[10px] text-theme-secondary opacity-60">
                  Preventing food waste, one meal at a time.
                </p>
                
                <div className="flex justify-center pt-1">
                  {/* Google Play Button */}
                  <a 
                    href="https://play.google.com/store" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-black border border-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-slate-950 transition-all active:scale-95 inline-flex"
                  >
                    <PlayStoreIcon className="w-4 h-4 text-white" />
                    <div className="text-left">
                      <p className="text-[7px] uppercase tracking-wider text-white/60 font-semibold leading-none">Get it on</p>
                      <p className="text-[10px] text-white font-bold leading-tight">Google Play</p>
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