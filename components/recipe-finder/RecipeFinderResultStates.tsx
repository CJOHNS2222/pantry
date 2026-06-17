import React from 'react';
import { useIntl } from 'react-intl';
import { Search, Sparkles, Zap } from 'lucide-react';
import { AppBadge } from '../ui/AppBadge';
import { GeminiLoadingOverlay, RECIPE_SEARCH_STAGES } from '../ui/GeminiLoadingOverlay';
import { SectionStatePanel } from '../ui/SectionStatePanel';
import { RecipeCardSkeleton } from '../ui/SkeletonLoader';
import { LoadingState, RecipeSearchResult, StructuredRecipe } from '../../types';

interface RecipeFinderResultStatesProps {
  loadingState: LoadingState;
  searchError: string | null;
  result: RecipeSearchResult | null;
  isResultFromCache: boolean;
  renderRecipeTile: (recipe: StructuredRecipe) => React.ReactNode;
  onEnableAiSearch: () => void;
  onRetry: () => void;
  onSuggestionClick: (value: string) => void;
}

export const RecipeFinderResultStates: React.FC<RecipeFinderResultStatesProps> = ({
  loadingState,
  searchError,
  result,
  isResultFromCache,
  renderRecipeTile,
  onEnableAiSearch,
  onRetry,
  onSuggestionClick,
}) => {
  const intl = useIntl();

  return (
    <>
      {loadingState === LoadingState.LOADING && (
        <div className="animate-fade-in-up mt-8">
          <SectionStatePanel
            icon={<Sparkles className="w-6 h-6 text-[var(--accent-color)]" />}
            title="Building recipe ideas"
            description="We’re matching pantry signals, preferences, and saved context so the next set feels tailored rather than random."
            tone="subtle"
          >
            <GeminiLoadingOverlay isActive totalSeconds={35} stages={RECIPE_SEARCH_STAGES} variant="inline" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <RecipeCardSkeleton key={`recipefinder-loading-${idx}`} />
              ))}
            </div>
          </SectionStatePanel>
        </div>
      )}

      {loadingState === LoadingState.ERROR && (
        <div className="p-4 bg-red-900/20 border border-red-500 text-red-400 rounded-xl text-center font-medium">
          {searchError?.includes('opt-in required') ? (
            <>
              <div className="text-base mb-1">AI search requires your permission.</div>
              <div className="text-xs text-red-300 mb-3">Enable AI features to search with Gemini.</div>
              <button
                onClick={onEnableAiSearch}
                className="mt-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ✨ Enable AI &amp; Search
              </button>
            </>
          ) : (
            <>
              <div>Search failed. Please try again.</div>
              {searchError && <div className="text-xs mt-2 text-red-300">Error: {searchError}</div>}
              <button
                onClick={onRetry}
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      )}

      {result && result.recipes && (
        <div className="animate-fade-in-up mt-8">
          {isResultFromCache && (
            <div className="flex justify-center mb-4">
              <AppBadge variant="success" size="sm" className="shadow-sm">
                <Zap className="w-3 h-3" />
                Instant Results (Cached)
              </AppBadge>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">{result.recipes.map((recipe) => renderRecipeTile(recipe))}</div>
        </div>
      )}

      {loadingState === LoadingState.SUCCESS && result && (!result.recipes || result.recipes.length === 0) && (
        <div className="animate-fade-in-up mt-8">
          <SectionStatePanel
            icon={<Search className="w-10 h-10 text-theme-secondary/60" />}
            title={intl.formatMessage({ id: 'recipes.noResults' })}
            description="No strong matches surfaced from the current search. Try a broader ingredient, a cuisine, or one of these quick pivots."
            tone="subtle"
          >
            <p className="text-sm text-theme-secondary mb-4">{intl.formatMessage({ id: 'recipes.tryAdjusting' })}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['chicken', 'pasta', 'salad'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSuggestionClick(suggestion)}
                  aria-label={`Search for ${suggestion} recipes`}
                  className="px-3 py-1.5 bg-theme-primary border border-theme rounded-full hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors text-sm text-theme-primary"
                >
                  Try {suggestion}
                </button>
              ))}
            </div>
          </SectionStatePanel>
        </div>
      )}
    </>
  );
};
