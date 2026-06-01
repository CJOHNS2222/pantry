import React from 'react';
import { Bookmark } from 'lucide-react';

interface RecipeFinderTabsProps {
  activeView: 'search' | 'saved';
  setActiveView: React.Dispatch<React.SetStateAction<'search' | 'saved'>>;
  savedCount: number;
}

export const RecipeFinderTabs: React.FC<RecipeFinderTabsProps> = ({ activeView, setActiveView, savedCount }) => {
  return (
    <div className="flex justify-center gap-4 mb-2" role="tablist" aria-label="Recipe finder tabs">
      <button
        onClick={() => setActiveView('search')}
        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeView === 'search' ? 'bg-[var(--accent-color)] text-white' : 'text-theme-secondary opacity-50'}`}
        role="tab"
        aria-selected={activeView === 'search'}
        aria-controls="search-panel"
        id="search-tab"
      >
        Search & Generate
      </button>
      <button
        onClick={() => setActiveView('saved')}
        className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeView === 'saved' ? 'bg-[var(--accent-color)] text-white' : 'text-theme-secondary opacity-50'}`}
        role="tab"
        aria-selected={activeView === 'saved'}
        aria-controls="saved-panel"
        id="saved-tab"
      >
        <Bookmark className="w-4 h-4" aria-hidden="true" /> Saved ({savedCount})
      </button>
    </div>
  );
};
