import React, { useState, useEffect, useContext } from 'react';
import { Users, TrendingUp, ChefHat, MessageSquare, Loader2, ThumbsUp } from 'lucide-react';
import { RecipeCommunityStats, RecipeModification, RecipeRating } from '../../types';
import { RecipeRatingService } from '../../services/recipeRatingService';
import DatabaseMonitoringService from '../../services/databaseMonitoringService';
import AppContext from '../../contexts/AppContext';
import { useToast } from '../ui/Toast';
import { log } from '../../services/logService';

interface RecipeCommunityInsightsProps {
  recipeTitle: string;
  householdId?: string;
}

export const RecipeCommunityInsights: React.FC<RecipeCommunityInsightsProps> = ({
  recipeTitle,
  householdId
}) => {
  const context = useContext(AppContext);
  const user = context?.user;
  const toast = useToast();
  const [stats, setStats] = useState<RecipeCommunityStats | null>(null);
  const [topModifications, setTopModifications] = useState<RecipeModification[]>([]);
  const [householdRatings, setHouseholdRatings] = useState<RecipeRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCommunityData();

    // Subscribe to realtime updates for the community stats doc so UI updates when stats are created/updated
    let unsubscribeStats: (() => void) | null = null;
    try {
      const statsRef = DatabaseMonitoringService.doc('recipeCommunityStats', recipeTitle);
      unsubscribeStats = DatabaseMonitoringService.onSnapshot(statsRef, (snap) => {
        log.debug('RecipeCommunityInsights realtime stats snapshot', { recipeTitle, exists: snap.exists() }, 'RecipeCommunityInsights');
        if (snap.exists()) {
          const data = snap.data();
          setStats({ ...data } as RecipeCommunityStats);
        }
      });
    } catch (e) {
      log.debug('RecipeCommunityInsights realtime subscribe failed', { error: e }, 'RecipeCommunityInsights');
    }

    return () => {
      if (unsubscribeStats) unsubscribeStats();
    };
  }, [recipeTitle, householdId]);

  const loadCommunityData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load community stats
      const communityStats = await RecipeRatingService.getCommunityStats(recipeTitle, householdId);
      log.debug('RecipeCommunityInsights fetched communityStats', { recipeTitle, hasStats: Boolean(communityStats) }, 'RecipeCommunityInsights');
      setStats(communityStats);

      // Load top modifications
      const modifications = await RecipeRatingService.getTopModifications(recipeTitle, 5);
      log.debug('RecipeCommunityInsights fetched modifications', { count: modifications.length }, 'RecipeCommunityInsights');
      setTopModifications(modifications);

      // Load household ratings
      if (householdId) {
        const householdRatingsData = await RecipeRatingService.getHouseholdRatings(recipeTitle, householdId);
        log.debug('RecipeCommunityInsights fetched household ratings', { count: householdRatingsData.length }, 'RecipeCommunityInsights');
        setHouseholdRatings(householdRatingsData);
      }
    } catch (err) {
      log.error('Failed to load community data', { error: err }, 'RecipeCommunityInsights');
      setError('Failed to load community insights');
      toast.error('Failed to load community insights');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModificationHelpful = async (modificationId: string) => {
    if (!user?.id) return;

    try {
      await RecipeRatingService.markModificationHelpful(modificationId, user.id);
      // Reload modifications to get updated helpful count
      const modifications = await RecipeRatingService.getTopModifications(recipeTitle, 5);
      setTopModifications(modifications);
      toast.success('Thanks for your feedback!');
    } catch (err) {
      log.error('Failed to mark modification as helpful', { error: err }, 'RecipeCommunityInsights');
      toast.error('Failed to mark as helpful');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-color)]" />
        <span className="ml-2 text-theme-secondary">Loading community insights...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="text-center text-theme-secondary">
          {error || 'No community data available yet'}
        </div>
      </div>
    );
  }
  const formatPercentage = (value: number) => `${Math.round(value)}%`;

  const getFeedbackEmoji = (type: string) => {
    const emojiMap: Record<string, string> = {
      'too-spicy': '🌶️',
      'too-bland': '🫠',
      'too-time-consuming': '⏰',
      'too-complicated': '🤯',
      'love-it': '❤️',
      'family-favorite': '👨‍👩‍👧‍👦',
      'easy-weeknight': '🍽️',
      'impressive-guests': '🎉'
    };
    return emojiMap[type] || '📝';
  };

  const getModificationIcon = (type: string) => {
    switch (type) {
      case 'added': return '➕';
      case 'removed': return '➖';
      case 'substituted': return '🔄';
      case 'changed-quantity': return '⚖️';
      case 'changed-method': return '👨‍🍳';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Community Stats */}
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="text-lg font-semibold text-theme-primary">Community Insights</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-theme-primary mb-1">
              {stats.totalRatings}
            </div>
            <div className="text-sm text-theme-secondary">Total Reviews</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500 mb-1">
              {formatPercentage(stats.wouldMakeAgainPercentage)}
            </div>
            <div className="text-sm text-theme-secondary">Would Make Again</div>
          </div>
        </div>

        {/* Household Stats */}
        {stats.householdStats && (
          <div className="p-3 bg-theme-primary rounded-lg border border-theme/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-theme-primary">Your Household</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-secondary">
                {stats.householdStats.householdRatings} reviews
              </span>
              <span className="text-theme-primary font-medium">
                {formatPercentage(stats.householdStats.householdWouldMakeAgain)} would make again
              </span>
            </div>
          </div>
        )}

        {/* Top Feedback */}
        {stats.topFeedback && stats.topFeedback.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-theme-secondary mb-2">Most Common Feedback:</div>
            <div className="flex flex-wrap gap-2">
              {stats.topFeedback.slice(0, 6).map((feedback, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-3 py-1 bg-theme-primary rounded-full text-xs text-theme-primary border border-theme/50"
                >
                  <span>{getFeedbackEmoji(feedback.type)}</span>
                  <span>{feedback.type.replace('-', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Modifications */}
      {topModifications.length > 0 && (
        <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="text-lg font-semibold text-theme-primary">Popular Modifications</h3>
          </div>

          <div className="space-y-3">
            {topModifications.slice(0, 5).map((mod) => (
              <div key={mod.id} className="p-3 bg-theme-primary rounded-lg border border-theme/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getModificationIcon(mod.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-theme-primary font-medium leading-tight">
                        {mod.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-theme-secondary">
                          by {mod.userName}
                        </span>
                        {mod.userAvatar && (
                          <img
                            src={mod.userAvatar}
                            alt={mod.userName}
                            className="w-4 h-4 rounded-full"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  {user?.id && (
                    <button
                      onClick={() => handleModificationHelpful(mod.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-theme-secondary hover:text-[var(--accent-color)] transition-colors"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{mod.helpful}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Household Ratings */}
      {householdRatings.length > 0 && (
        <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="text-lg font-semibold text-theme-primary">Household Reviews</h3>
          </div>

          <div className="space-y-3">
            {householdRatings.slice(0, 3).map((rating) => (
              <div key={rating.id} className="p-3 bg-theme-primary rounded-lg border border-theme/50">
                <div className="flex items-center gap-2 mb-2">
                  {rating.userAvatar ? (
                    <img
                      src={rating.userAvatar}
                      alt={rating.userName}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white text-xs font-bold">
                      {rating.userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-theme-primary">{rating.userName}</span>
                  <span className="text-xs text-theme-secondary">
                    {rating.wouldMakeAgain ? 'Would make again' : 'Would modify'}
                  </span>
                </div>

                {rating.feedback && rating.feedback.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {rating.feedback.map((feedback, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-theme-secondary rounded-full text-xs text-theme-primary"
                      >
                        <span>{getFeedbackEmoji(feedback.type)}</span>
                        <span>{feedback.type.replace('-', ' ')}</span>
                      </span>
                    ))}
                  </div>
                )}

                {rating.comment && (
                  <p className="text-sm text-theme-secondary italic">
                    "{rating.comment}"
                  </p>
                )}
              </div>
            ))}

            {householdRatings.length > 3 && (
              <div className="text-center text-sm text-theme-secondary">
                +{householdRatings.length - 3} more reviews from your household
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeCommunityInsights;