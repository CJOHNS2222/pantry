import React, { useState } from 'react';
import { Search, Loader2, Sparkles, ExternalLink, Globe, ChefHat } from 'lucide-react';
import { searchRecipes } from '../services/geminiService';
import { RecipeSearchResult, LoadingState } from '../types';

export const RecipeFinder: React.FC = () => {
  const [ingredients, setIngredients] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [result, setResult] = useState<RecipeSearchResult | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredients.trim()) return;

    setLoadingState(LoadingState.LOADING);
    setResult(null);

    try {
      const data = await searchRecipes(ingredients, restrictions);
      setResult(data);
      setLoadingState(LoadingState.SUCCESS);
    } catch (error) {
      setLoadingState(LoadingState.ERROR);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100/50 backdrop-blur-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-emerald-600" />
            Recipe Finder
          </h2>
          <p className="text-gray-500 mt-1">
            Let Gemini find the perfect meal based on what you have.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What ingredients do you have?
            </label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g., chicken breast, old spinach, half a lemon, rice..."
              className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none h-32 text-gray-700 placeholder:text-gray-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Any dietary preferences? <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="e.g., Gluten-free, Vegetarian, Low Carb"
              className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loadingState === LoadingState.LOADING || !ingredients.trim()}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
              loadingState === LoadingState.LOADING
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/30'
            }`}
          >
            {loadingState === LoadingState.LOADING ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Searching Web with Gemini...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Find Recipes
              </>
            )}
          </button>
        </form>
      </div>

      {loadingState === LoadingState.ERROR && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-center font-medium animate-pulse">
          Something went wrong while searching. Please check your connection and try again.
        </div>
      )}

      {result && (
        <div className="animate-fade-in-up space-y-6 pb-20">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 relative overflow-hidden">
             {/* Decorative Background Element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 pointer-events-none -z-0 translate-x-1/3 -translate-y-1/3"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6 text-emerald-700 font-bold text-lg border-b border-emerald-100 pb-4">
                <Sparkles className="w-5 h-5" />
                <h3>Suggested Recipes</h3>
              </div>
              
              {/* Render the plain text result nicely */}
              <div className="prose prose-emerald prose-headings:font-bold prose-a:text-emerald-600 max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {result.text}
              </div>
            </div>
          </div>

          {/* Sources Section from Grounding */}
          {result.groundingChunks && result.groundingChunks.length > 0 && (
            <div className="bg-white/80 backdrop-blur p-6 rounded-2xl border border-gray-200/50 shadow-sm">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Sources from Google Search
              </h4>
              <div className="grid gap-2">
                {result.groundingChunks.map((chunk, idx) => (
                  chunk.web?.uri ? (
                    <a
                      key={idx}
                      href={chunk.web.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="min-w-0 pr-4">
                         <span className="block font-medium text-gray-800 group-hover:text-emerald-700 truncate">
                          {chunk.web.title || chunk.web.uri}
                        </span>
                        <span className="block text-xs text-gray-400 truncate mt-0.5">
                          {chunk.web.uri}
                        </span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 flex-shrink-0" />
                    </a>
                  ) : null
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};