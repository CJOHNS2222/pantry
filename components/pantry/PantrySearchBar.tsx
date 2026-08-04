import React from 'react';
import { Search, Filter, LayoutGrid, LayoutList, X } from 'lucide-react';
import { PantryFilter } from '../../types';

interface PantrySearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'category' | 'storage';
  setViewMode: (mode: 'category' | 'storage') => void;
  sortBy: 'name' | 'lastAdded' | 'expiration' | 'category' | 'location';
  setSortBy: (sort: 'name' | 'lastAdded' | 'expiration' | 'category' | 'location') => void;
  displayLayout: 'list' | 'grid';
  toggleDisplayLayout: () => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  pantryFilter: PantryFilter;
  onOpenSearchModal: () => void;
}

export const PantrySearchBar: React.FC<PantrySearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  displayLayout,
  toggleDisplayLayout,
  showFilters,
  setShowFilters,
  pantryFilter,
  onOpenSearchModal,
}) => {
  const activeFilterCount =
    (pantryFilter.categories.length > 0 ? 1 : 0) +
    (pantryFilter.locations.length > 0 ? 1 : 0) +
    (pantryFilter.expirationStatus !== 'all' ? 1 : 0) +
    (pantryFilter.quantityStatus !== 'all' ? 1 : 0);
  const isFilterActive = activeFilterCount > 0;

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Filter + Layout + Bulk Mode */}
      <div className="flex items-center gap-2">
        {/* Quick Search Button */}
        <button
          onClick={onOpenSearchModal}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-theme-secondary border border-theme text-theme-secondary text-sm hover:border-[var(--accent-color)]/50 transition-colors shadow-sm min-w-0"
        >
          <Search className="w-4 h-4 text-theme-secondary shrink-0" />
          <span className="truncate">
            {searchQuery ? `Searching: "${searchQuery}"` : 'Search pantry items...'}
          </span>
        </button>

        {/* Filter toggle button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative p-2 rounded-xl border transition-colors shrink-0 ${
            showFilters || isFilterActive
              ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] border-[var(--accent-color)] shadow'
              : 'bg-theme-secondary border-theme text-theme-secondary hover:text-theme-primary'
          }`}
          aria-label="Filter options"
        >
          <Filter className="w-4 h-4" />
          {isFilterActive && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-white text-[var(--accent-color)] text-[10px] font-bold flex items-center justify-center border border-[var(--accent-color)]">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Display layout toggle (List vs Grid) */}
        <button
          onClick={toggleDisplayLayout}
          className="p-2 rounded-xl bg-theme-secondary border border-theme text-theme-secondary hover:text-theme-primary transition-colors shrink-0"
          aria-label={displayLayout === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        >
          {displayLayout === 'list' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
        </button>
      </div>

      {/* Row 2: View mode toggle + Sort dropdown */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* View mode toggle (Category vs Storage Location) */}
        <div className="flex bg-theme-secondary border border-theme rounded-xl p-0.5 shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('storage')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'storage'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] shadow'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Storage
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'category'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] shadow'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Category
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 text-xs text-theme-secondary">
          <span className="opacity-70">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'lastAdded' | 'expiration' | 'category' | 'location')}
            className="bg-transparent font-semibold text-theme-primary focus:outline-none cursor-pointer dark:text-slate-100"
          >
            <option value="location" className="bg-theme-primary text-theme-primary">Storage Location</option>
            <option value="name" className="bg-theme-primary text-theme-primary">Name (A-Z)</option>
            <option value="expiration" className="bg-theme-primary text-theme-primary">Expiration Date</option>
            <option value="lastAdded" className="bg-theme-primary text-theme-primary">Recently Added</option>
            <option value="category" className="bg-theme-primary text-theme-primary">Category</option>
          </select>
        </div>
      </div>

      {/* Row 3 (optional): Active search tag */}
      {searchQuery && (
        <div className="flex justify-end px-1">
          <button
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1 text-[11px] bg-theme-secondary border border-theme px-2 py-0.5 rounded-full text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <span>Search: "{searchQuery}"</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
