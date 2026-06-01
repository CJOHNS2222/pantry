import React from 'react';
import { Search, Mic, Clock, Sparkles, Loader2, ChefHat } from 'lucide-react';
import { LoadingState } from '../../types';

interface RecipeFinderSearchControlsProps {
  specificQuery: string;
  onSpecificQueryChange: (value: string) => void;
  onSpecificQueryFocus: () => void;
  onSpecificQueryBlur: () => void;
  onSpecificSearch: (event?: React.FormEvent) => void | Promise<void>;
  loadingState: LoadingState;
  voiceSearchSupported: boolean;
  isListening: boolean;
  onStartVoiceSearch: () => void;
  showRecipeAutocomplete: boolean;
  recentRecipeSearches: string[];
  onSelectRecentSearch: (value: string) => void;
  strictMode: boolean;
  onSetStrictMode: (value: boolean) => void;
  recipeType: 'Snack' | 'Dinner' | 'Dessert' | '';
  onSetRecipeType: (value: 'Snack' | 'Dinner' | 'Dessert' | '') => void;
  dietaryRestriction: string;
  onSetDietaryRestriction: (value: string) => void;
  maxPrepTime: string;
  onSetMaxPrepTime: (value: string) => void;
  servings: string;
  onSetServings: (value: string) => void;
  maxCookTime: string;
  onSetMaxCookTime: (value: string) => void;
  maxIngredients: string;
  onSetMaxIngredients: (value: string) => void;
  onGenerate: (event: React.FormEvent) => void;
}

export const RecipeFinderSearchControls: React.FC<RecipeFinderSearchControlsProps> = ({
  specificQuery,
  onSpecificQueryChange,
  onSpecificQueryFocus,
  onSpecificQueryBlur,
  onSpecificSearch,
  loadingState,
  voiceSearchSupported,
  isListening,
  onStartVoiceSearch,
  showRecipeAutocomplete,
  recentRecipeSearches,
  onSelectRecentSearch,
  strictMode,
  onSetStrictMode,
  recipeType,
  onSetRecipeType,
  dietaryRestriction,
  onSetDietaryRestriction,
  maxPrepTime,
  onSetMaxPrepTime,
  servings,
  onSetServings,
  maxCookTime,
  onSetMaxCookTime,
  maxIngredients,
  onSetMaxIngredients,
  onGenerate,
}) => {
  return (
    <>
      <div className="bg-theme-secondary p-5 rounded-2xl border border-theme shadow-lg">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              id="specificQuery"
              name="specificQuery"
              data-testid="recipefinder-search-input"
              value={specificQuery}
              onChange={(e) => onSpecificQueryChange(e.target.value)}
              onFocus={onSpecificQueryFocus}
              onBlur={onSpecificQueryBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSpecificSearch(); } }}
              placeholder="Search e.g. Pasta..."
              className={`w-full bg-theme-primary border border-theme rounded-xl px-4 py-3 text-theme-primary focus:border-[var(--accent-color)] outline-none ${voiceSearchSupported ? 'pr-10' : ''}`}
            />
            {voiceSearchSupported && (
              <button
                type="button"
                onClick={onStartVoiceSearch}
                data-testid="recipefinder-voice-button"
                disabled={loadingState === LoadingState.LOADING}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-theme-secondary hover:text-[var(--accent-color)] hover:bg-theme-secondary'
                }`}
                aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
                data-tutorial="voice-search"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            {showRecipeAutocomplete && (
              <div className="absolute top-full left-0 right-0 bg-theme-primary border border-theme rounded-lg shadow-lg mt-1 z-10 max-h-60 overflow-y-auto">
                {specificQuery.length === 0 && recentRecipeSearches.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-theme-secondary opacity-70 uppercase tracking-wider border-b border-theme">
                      Recent Searches
                    </div>
                    {recentRecipeSearches.map((recentQuery, index) => (
                      <button
                        key={`recent-recipe-${index}`}
                        onClick={() => onSelectRecentSearch(recentQuery)}
                        className="w-full text-left px-4 py-2 hover:bg-theme-secondary text-theme-primary flex items-center gap-2"
                      >
                        <Clock className="w-3 h-3 text-theme-secondary opacity-50" />
                        <span>{recentQuery}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onSpecificSearch}
            data-testid="recipefinder-search-button"
            disabled={loadingState === LoadingState.LOADING}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[var(--accent-color)] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            aria-label="Search recipes"
            data-tutorial="search-button"
          >
            {loadingState === LoadingState.LOADING ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Search</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-px bg-theme opacity-30 flex-1"></div>
        <span className="text-xs font-bold text-theme-secondary opacity-50 uppercase tracking-widest">OR</span>
        <div className="h-px bg-theme opacity-30 flex-1"></div>
      </div>

      <div className="bg-theme-secondary p-6 rounded-2xl border border-theme shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-color)] rounded-full blur-3xl opacity-10"></div>
        <h3 className="text-xs font-bold text-[var(--accent-color)] uppercase mb-4 flex items-center gap-2 relative z-10">
          <Sparkles className="w-4 h-4" /> Generate Ideas from Pantry
        </h3>

        <form onSubmit={onGenerate} className="space-y-4 relative z-10">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col justify-between bg-theme-primary p-3 rounded-xl border border-theme">
              <div className="flex bg-theme-secondary rounded-lg p-1 border border-theme h-10">
                <button
                  type="button"
                  onClick={() => onSetStrictMode(true)}
                  className={`flex-1 text-xs font-bold rounded transition-all ${strictMode ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary opacity-50'}`}
                >
                  Use Inventory Only
                </button>
                <button
                  type="button"
                  onClick={() => onSetStrictMode(false)}
                  className={`flex-1 text-xs font-bold rounded transition-all ${!strictMode ? 'bg-[var(--accent-color)] text-white shadow-sm' : 'text-theme-secondary opacity-50'}`}
                >
                  Allow Extra Items
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="recipeType" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Type
              </label>
              <select
                id="recipeType"
                name="recipeType"
                value={recipeType}
                onChange={(e) => onSetRecipeType(e.target.value as 'Snack' | 'Dinner' | 'Dessert' | '')}
                className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
              >
                <option value="">Any</option>
                <option value="Snack">Snack</option>
                <option value="Dinner">Dinner</option>
                <option value="Dessert">Dessert</option>
              </select>
            </div>
            <div>
              <label htmlFor="dietaryRestrictions" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Diet
              </label>
              <select
                id="dietaryRestrictions"
                name="dietaryRestrictions"
                value={dietaryRestriction}
                onChange={(e) => onSetDietaryRestriction(e.target.value)}
                className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
              >
                <option value="">Any</option>
                <option value="vegetarian">Veg</option>
                <option value="vegan">Vegan</option>
                <option value="gluten-free">GF</option>
                <option value="dairy-free">DF</option>
                <option value="keto">Keto</option>
                <option value="paleo">Paleo</option>
              </select>
            </div>
            <div>
              <label htmlFor="maxPrepTime" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Prep
              </label>
              <div className="relative">
                <input
                  id="maxPrepTime"
                  name="maxPrepTime"
                  type="number"
                  min="0"
                  value={maxPrepTime}
                  onChange={(e) => onSetMaxPrepTime(e.target.value)}
                  className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
                />
                <span className="absolute right-1 top-1.5 opacity-50 text-[8px] font-bold">MIN</span>
              </div>
            </div>
            <div>
              <label htmlFor="servings" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Serves
              </label>
              <input
                id="servings"
                name="servings"
                type="number"
                min="0"
                value={servings}
                onChange={(e) => onSetServings(e.target.value)}
                className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="maxCookTime" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Cook
              </label>
              <div className="relative">
                <input
                  id="maxCookTime"
                  name="maxCookTime"
                  type="number"
                  min="0"
                  value={maxCookTime}
                  onChange={(e) => onSetMaxCookTime(e.target.value)}
                  className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
                />
                <span className="absolute right-1 top-1.5 opacity-50 text-[8px] font-bold">MIN</span>
              </div>
            </div>
            <div>
              <label htmlFor="maxIngredients" className="text-sm text-[var(--accent-color)] font-bold uppercase mb-1 block">
                Items
              </label>
              <input
                id="maxIngredients"
                name="maxIngredients"
                type="number"
                min="0"
                value={maxIngredients}
                onChange={(e) => onSetMaxIngredients(e.target.value)}
                className="w-full p-2 rounded-lg border border-theme bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] outline-none text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingState === LoadingState.LOADING}
            className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 bg-gradient-to-r from-[var(--accent-color)] to-[var(--text-secondary)] text-white shadow-lg mt-2"
          >
            {loadingState === LoadingState.LOADING ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChefHat className="w-5 h-5" />}
            Suggest Recipes
          </button>
        </form>
      </div>
    </>
  );
};
