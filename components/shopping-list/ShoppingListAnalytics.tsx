import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, DollarSign, Clock, Target, Award } from 'lucide-react';

interface ShoppingAnalytics {
  totalItems: number;
  completedItems: number;
  totalSpent: number;
  averageItemCost: number;
  shoppingFrequency: string;
  mostExpensiveCategory: string;
  completionRate: number;
  timeSpent: number; // in minutes
  itemsPerMinute: number;
}

interface ShoppingListAnalyticsProps {
  shoppingItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    isCompleted: boolean;
    estimatedPrice?: number;
    addedAt: Date;
    completedAt?: Date;
  }>;
  previousSessions?: Array<{
    date: Date;
    totalItems: number;
    completedItems: number;
    totalSpent: number;
    timeSpent: number;
  }>;
}

export const ShoppingListAnalytics: React.FC<ShoppingListAnalyticsProps> = ({
  shoppingItems,
  previousSessions = []
}) => {
  const analytics = useMemo(() => {
    const now = new Date();
    const completedItems = shoppingItems.filter(item => item.isCompleted);
    const totalSpent = shoppingItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
    const completedSpent = completedItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);

    // Calculate time spent (simplified - based on first add to last completion)
    const sortedItems = [...shoppingItems].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
    const firstAdd = sortedItems[0]?.addedAt;
    const lastCompletion = completedItems
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]?.completedAt;

    const timeSpent = firstAdd && lastCompletion
      ? Math.max(1, Math.round((lastCompletion.getTime() - firstAdd.getTime()) / (1000 * 60)))
      : 0;

    // Category spending
    const categorySpending = new Map<string, number>();
    shoppingItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      categorySpending.set(category, (categorySpending.get(category) || 0) + (item.estimatedPrice || 0));
    });

    const mostExpensiveCategory = Array.from(categorySpending.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

    // Shopping frequency based on previous sessions
    let shoppingFrequency = 'First time';
    if (previousSessions.length > 0) {
      const sortedSessions = previousSessions.sort((a, b) => b.date.getTime() - a.date.getTime());
      const lastSession = sortedSessions[0];
      const daysSince = Math.floor((now.getTime() - lastSession.date.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince <= 1) shoppingFrequency = 'Daily';
      else if (daysSince <= 7) shoppingFrequency = 'Weekly';
      else if (daysSince <= 14) shoppingFrequency = 'Bi-weekly';
      else if (daysSince <= 30) shoppingFrequency = 'Monthly';
      else shoppingFrequency = `${Math.floor(daysSince / 30)} months ago`;
    }

    return {
      totalItems: shoppingItems.length,
      completedItems: completedItems.length,
      totalSpent,
      averageItemCost: shoppingItems.length > 0 ? totalSpent / shoppingItems.length : 0,
      shoppingFrequency,
      mostExpensiveCategory,
      completionRate: shoppingItems.length > 0 ? (completedItems.length / shoppingItems.length) * 100 : 0,
      timeSpent,
      itemsPerMinute: timeSpent > 0 ? completedItems.length / timeSpent : 0
    } as ShoppingAnalytics;
  }, [shoppingItems, previousSessions]);

  const insights = useMemo(() => {
    const insights = [];

    if (analytics.completionRate >= 90) {
      insights.push({
        type: 'success',
        icon: <Award className="w-4 h-4 text-green-500" />,
        message: 'Excellent completion rate! You got almost everything.',
        value: `${Math.round(analytics.completionRate)}%`
      });
    } else if (analytics.completionRate >= 75) {
      insights.push({
        type: 'good',
        icon: <Target className="w-4 h-4 text-blue-500" />,
        message: 'Good job! Most items completed.',
        value: `${Math.round(analytics.completionRate)}%`
      });
    } else if (analytics.completionRate < 50) {
      insights.push({
        type: 'warning',
        icon: <TrendingUp className="w-4 h-4 text-orange-500" />,
        message: 'Consider planning ahead to improve completion.',
        value: `${Math.round(analytics.completionRate)}%`
      });
    }

    if (analytics.itemsPerMinute > 2) {
      insights.push({
        type: 'success',
        icon: <Clock className="w-4 h-4 text-green-500" />,
        message: 'Fast shopper! High efficiency rate.',
        value: `${analytics.itemsPerMinute.toFixed(1)} items/min`
      });
    }

    if (analytics.totalSpent > 0 && previousSessions.length > 0) {
      const avgPreviousSpent = previousSessions.reduce((sum, s) => sum + s.totalSpent, 0) / previousSessions.length;
      const percentChange = ((analytics.totalSpent - avgPreviousSpent) / avgPreviousSpent) * 100;

      if (Math.abs(percentChange) > 20) {
        insights.push({
          type: percentChange > 0 ? 'warning' : 'success',
          icon: <DollarSign className="w-4 h-4 text-orange-500" />,
          message: percentChange > 0 ? 'Spending increased significantly' : 'Great savings this trip!',
          value: `${percentChange > 0 ? '+' : ''}${Math.round(percentChange)}%`
        });
      }
    }

    return insights;
  }, [analytics, previousSessions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-[var(--accent-color)]" />
        <h3 className="text-sm font-semibold text-theme-primary">Shopping Analytics</h3>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-theme-primary rounded-lg p-3 border border-theme/50">
          <div className="text-xs text-theme-secondary opacity-70 mb-1">Progress</div>
          <div className="text-lg font-bold text-theme-primary">
            {analytics.completedItems}/{analytics.totalItems}
          </div>
          <div className="text-xs text-[var(--accent-color)]">
            {Math.round(analytics.completionRate)}% complete
          </div>
        </div>

        <div className="bg-theme-primary rounded-lg p-3 border border-theme/50">
          <div className="text-xs text-theme-secondary opacity-70 mb-1">Total Spent</div>
          <div className="text-lg font-bold text-theme-primary">
            {formatCurrency(analytics.totalSpent)}
          </div>
          <div className="text-xs text-theme-secondary">
            Avg: {formatCurrency(analytics.averageItemCost)}/item
          </div>
        </div>

        <div className="bg-theme-primary rounded-lg p-3 border border-theme/50">
          <div className="text-xs text-theme-secondary opacity-70 mb-1">Time Spent</div>
          <div className="text-lg font-bold text-theme-primary">
            {formatTime(analytics.timeSpent)}
          </div>
          <div className="text-xs text-theme-secondary">
            {analytics.itemsPerMinute.toFixed(1)} items/min
          </div>
        </div>

        <div className="bg-theme-primary rounded-lg p-3 border border-theme/50">
          <div className="text-xs text-theme-secondary opacity-70 mb-1">Frequency</div>
          <div className="text-sm font-bold text-theme-primary">
            {analytics.shoppingFrequency}
          </div>
          <div className="text-xs text-theme-secondary">
            Top category: {analytics.mostExpensiveCategory}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-theme-secondary opacity-70 mb-2">Insights:</div>
          {insights.map((insight, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-theme-primary rounded-lg border border-theme/50">
              {insight.icon}
              <div className="flex-1">
                <span className="text-sm text-theme-primary">{insight.message}</span>
              </div>
              <span className="text-sm font-medium text-[var(--accent-color)]">
                {insight.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-theme-secondary mb-1">
          <span>Shopping Progress</span>
          <span>{analytics.completedItems} of {analytics.totalItems} items</span>
        </div>
        <div className="w-full bg-theme-primary rounded-full h-2 border border-theme/50">
          <div
            className="bg-[var(--accent-color)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${analytics.completionRate}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ShoppingListAnalytics;