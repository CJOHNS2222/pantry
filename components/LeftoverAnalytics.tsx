import React, { useState, useEffect } from 'react';
import { LeftoverService } from '../services/leftoverService';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { PantryItem } from '../types';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

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
}

export const LeftoverAnalytics: React.FC<LeftoverAnalyticsProps> = ({ householdId, userId }) => {
  const [analytics, setAnalytics] = useState<LeftoverSavings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateLeftoverAnalytics();
  }, [householdId, userId]);

  const calculateLeftoverAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all current leftovers
      const leftovers = await LeftoverService.getLeftovers(householdId, userId);

      // For now, we'll calculate based on current leftovers
      // In a real implementation, you'd want to track historical data
      const totalServingsConsumed = leftovers.reduce((sum, leftover) => {
        const originalServings = leftover.leftoverMeta?.servings || 1;
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
      // This is a rough estimate - in reality you'd want actual cost data
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

      setAnalytics({
        totalServingsConsumed,
        totalServingsWasted,
        estimatedValueSaved,
        estimatedValueWasted,
        mealsReplaced,
        wasteReductionPercentage
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate analytics');
    } finally {
      setLoading(false);
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

      {/* Detailed Metrics */}
      <div className="space-y-4">
        <div className="bg-theme-secondary rounded-lg p-4 border border-theme">
          <h4 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Impact
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-400">Value Saved:</span>
              <span className="font-semibold text-green-400">${analytics.estimatedValueSaved.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">Potential Waste:</span>
              <span className="font-semibold text-red-400">${analytics.estimatedValueWasted.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-theme pt-2">
              <span className="text-theme-primary">Net Savings:</span>
              <span className="font-semibold text-theme-primary">
                ${(analytics.estimatedValueSaved - analytics.estimatedValueWasted).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-theme-secondary rounded-lg p-4 border border-theme">
          <h4 className="font-semibold text-theme-primary mb-3">Leftover Usage</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Servings Consumed:</span>
              <span className="font-semibold">{analytics.totalServingsConsumed.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Waste:</span>
              <span className="font-semibold">{analytics.totalServingsWasted.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-theme-secondary">
        <p>Analytics based on current leftover data</p>
        <p>Values are estimates and may vary based on actual food costs</p>
      </div>
    </div>
  );
};