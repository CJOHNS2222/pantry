import React from 'react';
import { Search, Filter, LayoutGrid, LayoutList, CheckSquare, X } from 'lucide-react';
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
  bulkMode: boolean;
  toggleBulkMode: () => void;
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
  bulkMode,
  toggleBulkMode,
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
      {/* Top row: search trigger + view mode toggle + layout mode toggle + bulk mode button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearchModal}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-theme-secondary border border-theme text-theme-secondary text-sm hover:border-[var(--accent-color)]/50 transition-colors shadow-sm"
          >
            <Search className="w-4 h-4 text-theme-secondary" />
            <span className="truncate">
              {searchQuery ? `Searching: "${searchQuery}"` : 'Search pantry items...'}
            </span>
          </button>

          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative p-2 rounded-xl border transition-colors ${
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
        </div>

        {/* View mode toggle (Category vs Storage Location) */}
        <div className="flex bg-theme-secondary border border-theme rounded-xl p-0.5 shadow-sm shrink-0">
          <button
            onClick={() => setViewMode('storage')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'storage'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] shadow'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Storage
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'category'
                ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] shadow'
                : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Category
          </button>
        </div>

        {/* Display layout toggle (List vs Grid) */}
        <button
          onClick={toggleDisplayLayout}
          className="p-2 rounded-xl bg-theme-secondary border border-theme text-theme-secondary hover:text-theme-primary transition-colors shrink-0"
          aria-label={displayLayout === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        >
          {displayLayout === 'list' ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
        </button>

        {/* Bulk select mode toggle */}
        <button
          onClick={toggleBulkMode}
          className={`p-2 rounded-xl border transition-colors shrink-0 ${
            bulkMode
              ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)] border-[var(--accent-color)] shadow'
              : 'bg-theme-secondary border-theme text-theme-secondary hover:text-theme-primary'
          }`}
          aria-label="Bulk select mode"
        >
          <CheckSquare className="w-4 h-4" />
        </button>
      </div>

      {/* Second row: Sort selector & Active search tag */}
      <div className="flex items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 text-theme-secondary">
          <span className="opacity-70">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'lastAdded' | 'expiration' | 'category' | 'location')}
            className="bg-transparent font-semibold text-theme-primary focus:outline-none cursor-pointer"
          >
            <option value="location">Storage Location</option>
            <option value="name">Name (A-Z)</option>
            <option value="expiration">Expiration Date</option>
            <option value="lastAdded">Recently Added</option>
            <option value="category">Category</option>
          </select>
        </div>

        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="flex items-center gap-1 text-[11px] bg-theme-secondary border border-theme px-2 py-0.5 rounded-full text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <span>Search: "{searchQuery}"</span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
