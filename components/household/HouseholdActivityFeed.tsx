import React from 'react';
import { HouseholdActivityService } from '../../services/householdActivityService';
import { Clock, User, Package, ShoppingCart, ChefHat, Heart } from 'lucide-react';
import type { HouseholdActivity } from '../../types';

interface HouseholdActivityFeedProps {
  activities: HouseholdActivity[];
  isLoading: boolean;
  maxItems?: number;
}

export const HouseholdActivityFeed: React.FC<HouseholdActivityFeedProps> = ({
  activities,
  isLoading,
  maxItems = 5
}) => {
  if (isLoading) {
    return (
      <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30">
        <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-red-900/30 rounded mb-2"></div>
              <div className="h-3 bg-red-900/20 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30">
        <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">Recent Activity</h3>
        <div className="text-center py-4">
          <Package className="w-8 h-8 text-red-200/30 mx-auto mb-2" />
          <p className="text-sm text-red-200/50">No recent activity yet</p>
          <p className="text-sm text-red-200/40 mt-1">Add pantry items or update your shopping list to see updates here.</p>
        </div>
      </div>
    );
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'added_item':
        return <Package className="w-4 h-4 text-green-500" />;
      case 'removed_item':
        return <Package className="w-4 h-4 text-red-500" />;
      case 'added_to_shopping':
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case 'completed_shopping':
        return <ShoppingCart className="w-4 h-4 text-amber-500" />;
      case 'created_meal_plan':
        return <ChefHat className="w-4 h-4 text-purple-500" />;
      case 'added_recipe':
        return <Heart className="w-4 h-4 text-pink-500" />;
      case 'completed_meal':
        return <ChefHat className="w-4 h-4 text-green-500" />;
      case 'joined_household':
        return <User className="w-4 h-4 text-amber-500" />;
      default:
        return <User className="w-4 h-4 text-red-200/50" />;
    }
  };

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="bg-[#2A0A10]/50 p-4 rounded-xl border border-red-900/30">
      <h3 className="text-sm font-bold text-amber-500 uppercase mb-3">Recent Activity</h3>
      <div className="space-y-3">
        {displayedActivities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(activity.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white leading-tight">
                {HouseholdActivityService.getActivityMessage(activity)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-red-200/50" />
                <span className="text-sm text-red-200/50">
                  {HouseholdActivityService.getRelativeTime(activity.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activities.length > maxItems && (
        <div className="mt-3 pt-3 border-t border-red-900/30">
          <p className="text-sm text-red-200/50 text-center">
            +{activities.length - maxItems} more activities
          </p>
        </div>
      )}
    </div>
  );
};