import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  ChefHat,
  ShoppingCart,
  Camera,
  Heart,
  Star,
  Calendar,
  Settings
} from 'lucide-react';
import AnalyticsService from '../services/analyticsService';

interface UserBehaviorMetrics {
  totalUsers: number;
  activeUsers: number;
  sessionDuration: number;
  featureUsage: {
    pantryScanner: number;
    recipeSearch: number;
    mealPlanning: number;
    shoppingList: number;
    analyticsView: number;
  };
  conversionFunnel: {
    appOpens: number;
    tutorialStarts: number;
    tutorialCompletes: number;
    premiumUpgrades: number;
  };
  popularFeatures: Array<{
    name: string;
    usage: number;
    growth: number;
    icon: React.ReactNode;
  }>;
  userJourneys: Array<{
    path: string;
    users: number;
    conversion: number;
  }>;
}

const UserBehaviorAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [metrics, setMetrics] = useState<UserBehaviorMetrics | null>(null);

  // Track analytics view
  useEffect(() => {
    AnalyticsService.trackAnalyticsView('user_behavior');
  }, []);

  // Mock data - in a real implementation, this would come from Firebase Analytics API
  // or aggregated data stored in Firestore
  useEffect(() => {
    // Simulate loading metrics
    const loadMetrics = () => {
      const mockMetrics: UserBehaviorMetrics = {
        totalUsers: 1250,
        activeUsers: 890,
        sessionDuration: 8.5, // minutes
        featureUsage: {
          pantryScanner: 1450,
          recipeSearch: 3200,
          mealPlanning: 980,
          shoppingList: 2100,
          analyticsView: 340
        },
        conversionFunnel: {
          appOpens: 5000,
          tutorialStarts: 1200,
          tutorialCompletes: 850,
          premiumUpgrades: 120
        },
        popularFeatures: [
          {
            name: 'Recipe Search',
            usage: 3200,
            growth: 15.2,
            icon: <ChefHat className="w-5 h-5" />
          },
          {
            name: 'Shopping List',
            usage: 2100,
            growth: 8.7,
            icon: <ShoppingCart className="w-5 h-5" />
          },
          {
            name: 'Pantry Scanner',
            usage: 1450,
            growth: 22.1,
            icon: <Camera className="w-5 h-5" />
          },
          {
            name: 'Meal Planning',
            usage: 980,
            growth: 12.5,
            icon: <Calendar className="w-5 h-5" />
          },
          {
            name: 'Recipe Ratings',
            usage: 650,
            growth: 5.3,
            icon: <Star className="w-5 h-5" />
          }
        ],
        userJourneys: [
          {
            path: 'Pantry → Recipe Search → Shopping List',
            users: 450,
            conversion: 68.2
          },
          {
            path: 'Recipe Search → Meal Planning → Shopping List',
            users: 320,
            conversion: 54.7
          },
          {
            path: 'Pantry Scanner → Recipe Search → Save Recipe',
            users: 280,
            conversion: 42.1
          },
          {
            path: 'Tutorial → Recipe Search → Premium Upgrade',
            users: 95,
            conversion: 31.8
          }
        ]
      };

      setMetrics(mockMetrics);
    };

    loadMetrics();
  }, [timeRange]);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return num.toFixed(1) + '%';
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-serif font-bold text-theme-secondary">User Behavior Analytics</h2>
          <p className="text-theme-secondary opacity-60 text-sm mt-1">Understanding how users interact with your app</p>
        </div>

        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'bg-theme-secondary text-theme-primary hover:bg-theme-primary'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Total Users</span>
          </div>
          <div className="text-2xl font-bold text-[var(--accent-color)]">{formatNumber(metrics.totalUsers)}</div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Active Users</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{formatNumber(metrics.activeUsers)}</div>
          <div className="text-xs text-green-600">
            {formatPercentage((metrics.activeUsers / metrics.totalUsers) * 100)} of total
          </div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Avg Session</span>
          </div>
          <div className="text-2xl font-bold text-blue-500">{metrics.sessionDuration}m</div>
        </div>

        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-theme-primary opacity-70 uppercase">Conversion Rate</span>
          </div>
          <div className="text-2xl font-bold text-purple-500">
            {formatPercentage((metrics.conversionFunnel.premiumUpgrades / metrics.conversionFunnel.appOpens) * 100)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Usage */}
        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Feature Usage
          </h3>
          <div className="space-y-3">
            {metrics.popularFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-theme-primary">{feature.icon}</div>
                  <div>
                    <div className="text-sm font-medium text-theme-primary">{feature.name}</div>
                    <div className="text-xs text-theme-secondary opacity-70">
                      {formatNumber(feature.usage)} uses
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${feature.growth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {feature.growth > 0 ? '+' : ''}{formatPercentage(feature.growth)}
                  </div>
                  <div className="text-xs text-theme-secondary opacity-70">vs last period</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
          <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Conversion Funnel
          </h3>
          <div className="space-y-4">
            {[
              { label: 'App Opens', value: metrics.conversionFunnel.appOpens, color: 'bg-blue-500' },
              { label: 'Tutorial Starts', value: metrics.conversionFunnel.tutorialStarts, color: 'bg-green-500' },
              { label: 'Tutorial Completes', value: metrics.conversionFunnel.tutorialCompletes, color: 'bg-yellow-500' },
              { label: 'Premium Upgrades', value: metrics.conversionFunnel.premiumUpgrades, color: 'bg-purple-500' }
            ].map((step, idx) => {
              const percentage = (step.value / metrics.conversionFunnel.appOpens) * 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-theme-primary font-medium">{step.label}</span>
                    <span className="text-theme-secondary opacity-70">
                      {formatNumber(step.value)} ({formatPercentage(percentage)})
                    </span>
                  </div>
                  <div className="w-full bg-theme-primary rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${step.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User Journeys */}
        <div className="bg-theme-secondary p-4 rounded-lg border border-theme lg:col-span-2">
          <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Popular User Journeys
          </h3>
          <div className="space-y-3">
            {metrics.userJourneys.map((journey, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-theme-primary rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-medium text-theme-primary mb-1">{journey.path}</div>
                  <div className="text-xs text-theme-secondary opacity-70">
                    {formatNumber(journey.users)} users
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--accent-color)]">
                    {formatPercentage(journey.conversion)}
                  </div>
                  <div className="text-xs text-theme-secondary opacity-70">conversion</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-theme-secondary p-4 rounded-lg border border-theme">
        <h3 className="text-lg font-bold text-[var(--accent-color)] mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-theme-primary">Recipe Search is the most popular feature</div>
                <div className="text-xs text-theme-secondary opacity-70">3,200 uses in the last 30 days</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-theme-primary">Pantry Scanner shows highest growth</div>
                <div className="text-xs text-theme-secondary opacity-70">+22.1% increase vs last period</div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-theme-primary">Tutorial completion rate is 70.8%</div>
                <div className="text-xs text-theme-secondary opacity-70">850 out of 1,200 users complete onboarding</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-theme-primary">Premium conversion needs improvement</div>
                <div className="text-xs text-theme-secondary opacity-70">Only 2.4% of users upgrade to premium</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserBehaviorAnalytics;