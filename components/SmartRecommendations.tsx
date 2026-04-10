import React, { useMemo, useState } from 'react';
import { ChefHat, Clock, Lightbulb, Star, ChevronDown, ChevronUp } from 'lucide-react';
import AnalyticsService from '../services/analyticsService';
import { log } from '../services/logService';
import { PantryItem, SavedRecipe, User } from '../types';

/**
 * Interface for smart recommendation data
 */
interface SmartRecommendation {
  id: string;
  type: 'recipe' | 'feature' | 'shopping' | 'meal_plan';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  actionText: string;
  category: string;
}

/**
 * SmartRecommendations component provides AI-powered personalized suggestions
 * based on user behavior, inventory, and usage patterns.
 *
 * Features:
 * - Recipe matching based on current pantry inventory
 * - Feature adoption recommendations for unused functionality
 * - Time-based suggestions (dinner time, expiring items)
 * - Usage pattern analysis and personalized insights
 * - Impact-based prioritization (high/medium/low)
 */
interface SmartRecommendationsProps {
  inventory: PantryItem[];
  savedRecipes: SavedRecipe[];
  user?: User | null;
}

const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({ inventory, savedRecipes, user }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const recommendations = useMemo((): SmartRecommendation[] => {
    const recs: SmartRecommendation[] = [];

    const hasInventory = inventory.length > 0;
    const hasSavedRecipes = savedRecipes.length > 0;

    // Recipe-based recommendations — match pantry items against saved recipe ingredients
    if (hasInventory && hasSavedRecipes) {
      const inventoryItems = inventory.map((item) => item.item.toLowerCase());

      const matchingRecipes = savedRecipes.filter((recipe) =>
        recipe.ingredients?.some((ingredient) =>
          inventoryItems.some((item) =>
            ingredient.toLowerCase().includes(item) || item.includes(ingredient.toLowerCase())
          )
        )
      );

      if (matchingRecipes.length > 0) {
        recs.push({
          id: 'recipe-match-inventory',
          type: 'recipe',
          title: 'Cook with What You Have',
          description: `You have ingredients for ${matchingRecipes.length} saved recipe${matchingRecipes.length > 1 ? 's' : ''}. Try making ${matchingRecipes[0].title} tonight!`,
          impact: 'high',
          icon: <ChefHat className="w-5 h-5" />,
          actionText: 'View Recipe',
          category: 'Recipe Match'
        });
      }
    }

    // Time-based recommendations
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 17 && hour <= 21 && hasSavedRecipes) {
      recs.push({
        id: 'dinner-time',
        type: 'recipe',
        title: 'Dinner Time Inspiration',
        description: 'It\'s dinner time! Check out your saved recipes for quick meal ideas.',
        impact: 'high',
        icon: <Clock className="w-5 h-5" />,
        actionText: 'Browse Recipes',
        category: 'Time-Based'
      });
    }

    // Expiring inventory alert
    if (hasInventory) {
      const expiringSoon = inventory.filter((item) => {
        if (!item.expirationDate) return false;
        const expiry = new Date(item.expirationDate);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
      });

      if (expiringSoon.length > 0) {
        const names = expiringSoon.map(i => i.item).join(', ');
        recs.push({
          id: 'use-expiring-items',
          type: 'recipe',
          title: 'Use Before It Expires',
          description: `Expiring soon: ${names}. Plan meals around them!`,
          impact: 'high',
          icon: <Clock className="w-5 h-5" />,
          actionText: 'Find Recipes',
          category: 'Inventory Alert'
        });
      }
    }

    // Premium upgrade suggestion
    if (user?.subscription?.tier !== 'premium') {
      recs.push({
        id: 'upgrade-premium',
        type: 'feature',
        title: 'Unlock Advanced Features',
        description: 'Get unlimited recipes, advanced meal planning, and priority support with Premium.',
        impact: 'medium',
        icon: <Star className="w-5 h-5" />,
        actionText: 'Upgrade Now',
        category: 'Premium Feature'
      });
    }

    // Getting started nudge
    if (!hasInventory && !hasSavedRecipes) {
      recs.push({
        id: 'getting-started',
        type: 'feature',
        title: 'Getting Started Guide',
        description: 'Start by adding some items to your inventory to unlock personalized recommendations.',
        impact: 'high',
        icon: <Lightbulb className="w-5 h-5" />,
        actionText: 'Add First Item',
        category: 'Onboarding'
      });
    }

    return recs
      .sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact];
      })
      .slice(0, 5);

  }, [inventory, savedRecipes, user]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const handleRecommendationAction = (rec: SmartRecommendation) => {
    // Track the recommendation action
    (AnalyticsService as any).trackRecommendationAction?.(rec.id, rec.type);

    switch (rec.type) {
      case 'recipe':
        // Navigate to recipes tab
        if (rec.actionText.includes('View Recipe') || rec.actionText.includes('Browse Recipes')) {
          // This would need to be passed as a prop or accessed via context
          // For now, we'll just show a toast
          log.debug(`Navigate to recipes for: ${rec.title}`);
        } else if (rec.actionText.includes('Find Recipes')) {
          log.debug(`Find recipes using expiring items for: ${rec.title}`);
        }
        break;
      case 'feature':
        if (rec.actionText.includes('Create Meal Plan')) {
          log.debug('Navigate to meal planning');
        } else if (rec.actionText.includes('Upgrade Now')) {
          log.debug('Navigate to premium upgrade');
        } else if (rec.actionText.includes('Add First Item')) {
          log.debug('Navigate to add inventory item');
        }
        break;
      case 'shopping':
        if (rec.actionText.includes('Create List')) {
          log.debug('Navigate to shopping list creation');
        }
        break;
      default:
        log.debug(`Action for ${rec.type}: ${rec.actionText}`);
    }

    // For now, show a toast indicating the action
    // In a real implementation, this would navigate or perform the action
    log.debug(`Recommendation action: ${rec.actionText} for ${rec.title}`);
  };

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-8">
          <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Recommendations Yet</h3>
          <p className="text-gray-600">
            Start using the app to get personalized recommendations based on your behavior and preferences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-3">
      <button
        onClick={() => setIsCollapsed(c => !c)}
        className="w-full p-4 border-b flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        aria-expanded={!isCollapsed}
      >
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0" />
          Smart Recommendations
          {isCollapsed && recommendations.length > 0 && (
            <span className="text-xs font-normal text-gray-500 ml-1">({recommendations.length})</span>
          )}
        </h2>
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      {!isCollapsed && (
        <>
        <div className="divide-y">
          {recommendations.map((rec) => (
          <div key={rec.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  {rec.icon}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{rec.title}</h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getImpactColor(rec.impact)}`}>
                    {getImpactIcon(rec.impact)} {rec.impact.toUpperCase()} IMPACT
                  </span>
                </div>

                <p className="text-gray-600 mb-3">{rec.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{rec.category}</span>
                  <button 
                    onClick={() => handleRecommendationAction(rec)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {rec.actionText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {recommendations.length >= 5 && (
        <div className="p-4 bg-gray-50 border-t text-center">
          <p className="text-sm text-gray-600">
            More recommendations available as you continue using the app
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default SmartRecommendations;