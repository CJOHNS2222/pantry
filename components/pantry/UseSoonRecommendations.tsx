import React, { useState } from 'react';
import { ChefHat, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { RecipeSuggestion, PantryItem } from '../../types';
import { Tab } from '../../types/app';

interface UseSoonRecommendationsProps {
  recipeSuggestions: RecipeSuggestion[];
  inventory: PantryItem[];
  onDeleteItem: (index: number) => Promise<void>;
  setActiveTab?: (tab: Tab) => void;
  setInitialSearchQuery?: (query: string) => void;
}

export const UseSoonRecommendations: React.FC<UseSoonRecommendationsProps> = ({
  recipeSuggestions,
  inventory,
  onDeleteItem,
  setActiveTab,
  setInitialSearchQuery
}) => {
  const [showUseSoon, setShowUseSoon] = useState(false);

  if (recipeSuggestions.length === 0) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg mb-4 overflow-hidden">
      <button
        onClick={() => setShowUseSoon(s => !s)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-green-100 transition-colors"
        aria-expanded={showUseSoon}
      >
        <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
          <ChefHat className="w-4 h-4" />
          Use Soon - Recipe Ideas
          {!showUseSoon && <span className="text-xs font-normal text-green-600">({recipeSuggestions.slice(0, 3).length})</span>}
        </h3>
        {showUseSoon ? <ChevronUp className="w-4 h-4 text-green-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-green-600 flex-shrink-0" />}
      </button>
      {showUseSoon && (
        <div className="space-y-3 px-4 pb-4">
          {recipeSuggestions.slice(0, 3).map((suggestion) => (
            <div key={suggestion.itemId} className="bg-white rounded border border-green-100 p-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{suggestion.itemName}</p>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    suggestion.daysRemaining <= 1 ? 'bg-red-100 text-red-800' :
                    suggestion.daysRemaining <= 3 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {suggestion.daysRemaining}d left
                  </span>
                  <button
                    onClick={async () => {
                      const idx = inventory.findIndex(it => it.id === suggestion.itemId);
                      if (idx !== -1) await onDeleteItem(idx);
                    }}
                    className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                    aria-label={`Delete ${suggestion.itemName}`}
                    title="Delete from inventory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-2">{suggestion.reason}</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.suggestedRecipes.map((recipe, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (setActiveTab && setInitialSearchQuery) {
                        setInitialSearchQuery(recipe);
                        setActiveTab(Tab.RECIPES);
                      }
                    }}
                    className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors"
                  >
                    {recipe}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

