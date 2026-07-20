import React from 'react';
import { Bookmark } from 'lucide-react';

interface RecipeFinderTabsProps {
  activeView: 'search' | 'saved';
  setActiveView: React.Dispatch<React.SetStateAction<'search' | 'saved'>>;
  savedCount: number;
}

export const RecipeFinderTabs: React.FC<RecipeFinderTabsProps> = ({ activeView, setActiveView, savedCount }) => {
  return (
    <div className="flex bg-theme-secondary rounded-xl p-1 border border-theme shadow-sm" role="tablist" aria-label="Recipe finder tabs">
      <button
        onClick={() => setActiveView('search')}
        className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
          activeView === 'search'
            ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
            : 'text-theme-secondary opacity-60 hover:opacity-100'
        }`}
        role="tab"
        aria-selected={activeView === 'search'}
        aria-controls="search-panel"
        id="search-tab"
      >
        Search & Generate
      </button>
      <button
        onClick={() => setActiveView('saved')}
        className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
          activeView === 'saved'
            ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
            : 'text-theme-secondary opacity-60 hover:opacity-100'
        }`}
        role="tab"
        aria-selected={activeView === 'saved'}
        aria-controls="saved-panel"
        id="saved-tab"
      >
        <Bookmark className="w-3.5 h-3.5" aria-hidden="true" /> Saved ({savedCount})
      </button>
    </div>
  );
};
