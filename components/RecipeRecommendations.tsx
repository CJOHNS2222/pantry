import { AppBadge } from './AppBadge';
import React, { useState, useEffect, useContext } from 'react';
import { Heart, Users, TrendingUp, Clock, ChefHat, Star, Loader2 } from 'lucide-react';
import { StructuredRecipe } from '../types';
import { RecipeRecommendationService, RecipeRecommendation } from '../services/recipeRecommendationService';
import AppContext from '../contexts/AppContext';
import { useToasts } from '../hooks/useToasts';
import { log } from '../services/logService';

interface RecipeRecommendationsProps {
  pantryItems?: string[];
  dietaryRestrictions?: string[];
  onRecipeSelect?: (recipe: StructuredRecipe) => void;
  onDismissRecommendation?: (recipeId: string) => void;
}

export const RecipeRecommendations: React.FC<RecipeRecommendationsProps> = ({
  pantryItems = [],
  dietaryRestrictions = [],
  onRecipeSelect,
  onDismissRecommendation
}) => {
  const context = useContext(AppContext);
  const user = context?.user;
  const { addToast } = useToasts();
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizeText = (value: string): string => value.toLowerCase().trim();

  const getPreferenceSignals = (recipe: StructuredRecipe): { positive: string[]; warning: string[] } => {
    if (!user?.profile) return { positive: [], warning: [] };

    const searchableText = normalizeText([
      recipe.title || '',
      recipe.description || '',
      recipe.type || '',
      Array.isArray(recipe.ingredients) ? recipe.ingredients.join(' ') : ''
    ].join(' '));

    const positive: string[] = [];
    const warning: string[] = [];

    for (const cuisine of user.profile.favoriteCuisines || []) {
      if (searchableText.includes(normalizeText(cuisine))) {
        positive.push(`Matches favorite cuisine: ${cuisine}`);
      }
    }

    for (const protein of user.profile.preferredProteins || []) {
      if (searchableText.includes(normalizeText(protein))) {
        positive.push(`Includes preferred protein: ${protein}`);
      }
    }

    for (const disliked of user.profile.dislikedIngredients || []) {
      if (searchableText.includes(normalizeText(disliked))) {
        warning.push(`Contains disliked ingredient: ${disliked}`);
      }
    }

    return {
      positive: [...new Set(positive)].slice(0, 2),
      warning: [...new Set(warning)].slice(0, 1)
    };
  };

  useEffect(() => {
    if (user?.id) {
      loadRecommendations();
    }
  }, [user?.id, pantryItems, dietaryRestrictions]);

  const loadRecommendations = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      const recs = await RecipeRecommendationService.getPersonalizedRecommendations(
        user.id,
        user.householdId,
        pantryItems,
        dietaryRestrictions,
        5,
        user.profile
      );

      setRecommendations(recs);
    } catch (err) {
      log.error('Failed to load recommendations:', err);
      setError('Failed to load recommendations');
      addToast('Failed to load recipe recommendations', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissRecommendation = (recipeId: string) => {
    // For now, just remove from local state
    // In a real implementation, you'd save dismissed recommendations to user preferences
    setRecommendations(prev => prev.filter(rec => rec.recipe.id !== recipeId));
    onDismissRecommendation?.(recipeId);
  };
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'household-loved': return <Heart className="w-4 h-4 text-red-500" />;
      case 'trending': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'similar-ingredients': return <ChefHat className="w-4 h-4 text-green-500" />;
      case 'seasonal': return <Star className="w-4 h-4 text-orange-500" />;
      case 'personal-preference': return <Users className="w-4 h-4 text-purple-500" />;
      default: return <Star className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'household-loved': return 'border-red-500/20 bg-red-500/5';
      case 'trending': return 'border-blue-500/20 bg-blue-500/5';
      case 'similar-ingredients': return 'border-green-500/20 bg-green-500/5';
      case 'seasonal': return 'border-orange-500/20 bg-orange-500/5';
      case 'personal-preference': return 'border-purple-500/20 bg-purple-500/5';
      default: return 'border-theme/50 bg-theme-primary';
    }
  };

  const formatReason = (reason: string) => {
    // Replace generic placeholders with more specific text
    return reason.replace(/\d+ household members/g, 'Your household');
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Highly recommended';
    if (confidence >= 0.6) return 'Recommended';
    return 'Might like';
  };

  if (isLoading) {
    return (
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-color)]" />
          <span className="text-theme-secondary">Finding recipes you'll love...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="text-center text-theme-secondary">
          {error}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="text-center text-theme-secondary">
          No recommendations available yet. Try rating some recipes first!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-[var(--accent-color)]" />
        <h3 className="text-lg font-semibold text-theme-primary">Recommended for You</h3>
      </div>

      <div className="space-y-3">
        {recommendations.slice(0, 3).map((rec, index) => (
          (() => {
            const signals = getPreferenceSignals(rec.recipe);
            return (
              <div
                key={`${rec.recipe.title}-${index}`}
                className={`p-4 rounded-lg border ${getRecommendationColor(rec.type)} cursor-pointer hover:shadow-md transition-all`}
                onClick={() => onRecipeSelect?.(rec.recipe)}
                role="button"
                tabIndex={0}
                aria-label={`Open recommended recipe ${rec.recipe.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRecipeSelect?.(rec.recipe);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getRecommendationIcon(rec.type)}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-theme-primary text-sm truncate">
                        {rec.recipe.title}
                      </h4>
                      <p className="text-xs text-theme-secondary mt-1">
                        {formatReason(rec.reason)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium text-[var(--accent-color)]">
                      {getConfidenceLabel(rec.confidence)}
                    </span>
                    <span className="text-xs text-theme-secondary">
                      {Math.round(rec.confidence * 100)}% match
                    </span>
                  </div>
                </div>

                {(signals.positive.length > 0 || signals.warning.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {signals.positive.map((label) => (
                      <AppBadge key={label} variant="success" size="xs">
                        {label}
                      </AppBadge>
                    ))}
                    {signals.warning.map((label) => (
                      <AppBadge key={label} variant="warning" size="xs">
                        {label}
                      </AppBadge>
                    ))}
                  </div>
                )}

                {/* Household Data - Note: This would need to be populated from the service */}
                {rec.type === 'household-loved' && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-theme/30">
                    <div className="flex items-center gap-1 text-xs text-theme-secondary">
                      <Users className="w-3 h-3" />
                      <span>Loved by your household</span>
                    </div>
                  </div>
                )}

                {/* Recipe Quick Info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-theme-secondary">
                  {rec.recipe.cookTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{rec.recipe.cookTime}</span>
                    </div>
                  )}
                  {rec.recipe.ingredients && (
                    <div className="flex items-center gap-1">
                      <ChefHat className="w-3 h-3" />
                      <span>{rec.recipe.ingredients.length} ingredients</span>
                    </div>
                  )}
                </div>

                {/* Dismiss Button */}
                {onDismissRecommendation && rec.recipe.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissRecommendation(rec.recipe.id!);
                    }}
                    className="absolute top-2 right-2 text-theme-secondary hover:text-theme-primary transition-colors"
                    title="Dismiss recommendation"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })()
        ))}
      </div>

      {recommendations.length > 3 && (
        <div className="text-center mt-4">
          <button className="text-sm text-[var(--accent-color)] hover:underline">
            View {recommendations.length - 3} more recommendations
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipeRecommendations;