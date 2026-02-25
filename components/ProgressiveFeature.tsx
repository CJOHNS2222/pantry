import React, { useState, useEffect } from 'react';
import { Lightbulb, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ProgressiveFeatureProps {
  feature: string;
  title: string;
  description: string;
  triggerCondition: () => boolean; // Function that returns true when feature should be revealed
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'inline';
  dismissible?: boolean;
  autoHideDelay?: number; // Auto-hide after this many milliseconds
}

export const ProgressiveFeature: React.FC<ProgressiveFeatureProps> = ({
  feature,
  title,
  description,
  triggerCondition,
  children,
  position = 'top',
  dismissible = true,
  autoHideDelay
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this feature
    const dismissedFeatures = localStorage.getItem('dismissed-progressive-features') || '';
    if (dismissedFeatures.includes(feature)) {
      setIsDismissed(true);
      return;
    }

    // Check trigger condition
    if (triggerCondition()) {
      setIsRevealed(true);

      // Auto-hide if specified
      if (autoHideDelay) {
        setTimeout(() => {
          setIsRevealed(false);
        }, autoHideDelay);
      }
    }
  }, [feature, triggerCondition, autoHideDelay]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsRevealed(false);

    // Save dismissal to localStorage
    const dismissedFeatures = localStorage.getItem('dismissed-progressive-features') || '';
    const updated = dismissedFeatures ? `${dismissedFeatures},${feature}` : feature;
    localStorage.setItem('dismissed-progressive-features', updated);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (isDismissed || !isRevealed) {
    return <>{children}</>;
  }

  const hintContent = (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2 dark:bg-yellow-900/20 dark:border-yellow-800">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-800 text-sm mb-1 dark:text-yellow-200">
            {title}
          </h4>
          <p className="text-yellow-700 text-xs leading-relaxed dark:text-yellow-300">
            {description}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={toggleExpanded}
            className="text-yellow-600 hover:text-yellow-800 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="text-yellow-600 hover:text-yellow-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700">
          <div className="text-xs text-yellow-700 dark:text-yellow-300">
            💡 <strong>Pro tip:</strong> This feature becomes available as you use the app more.
            It helps you get the most out of Stock & Spoon!
          </div>
        </div>
      )}
    </div>
  );

  if (position === 'inline') {
    return (
      <div>
        {hintContent}
        {children}
      </div>
    );
  }

  return (
    <div className="relative">
      {position === 'top' && hintContent}
      {children}
      {position === 'bottom' && hintContent}
    </div>
  );
};

// Hook to manage progressive feature discovery
export const useProgressiveFeatures = () => {
  const [userStats, setUserStats] = useState({
    recipesViewed: 0,
    mealsPlanned: 0,
    itemsAdded: 0,
    voiceSearches: 0,
    daysActive: 0
  });

  useEffect(() => {
    // Load user stats from localStorage or service
    const stats = localStorage.getItem('user-progressive-stats');
    if (stats) {
      setUserStats(JSON.parse(stats));
    }
  }, []);

  const updateStats = (stat: keyof typeof userStats, increment = 1) => {
    setUserStats(prev => {
      const updated = { ...prev, [stat]: prev[stat] + increment };
      localStorage.setItem('user-progressive-stats', JSON.stringify(updated));
      return updated;
    });
  };

  // Trigger conditions for different features
  const triggerConditions = {
    advancedFilters: () => userStats.recipesViewed >= 10,
    mealPlanning: () => userStats.itemsAdded >= 5,
    voiceSearch: () => userStats.recipesViewed >= 3,
    analytics: () => userStats.daysActive >= 3,
    communityFeatures: () => userStats.mealsPlanned >= 2,
    smartSuggestions: () => userStats.recipesViewed >= 20
  };

  return {
    userStats,
    updateStats,
    triggerConditions
  };
};