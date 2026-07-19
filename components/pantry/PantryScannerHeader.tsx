import React from 'react';
import { Search, Filter, Camera, Plus, FilePlus, LayoutGrid, LayoutList, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface PantryScannerHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  displayLayout: 'list' | 'grid';
  onToggleLayout: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  onOpenAddModal: () => void;
  onOpenCamera: () => void;
  onOpenImportModal: () => void;
  shouldGlowAddButton?: boolean;
  itemCount: number;
}

export const PantryScannerHeader: React.FC<PantryScannerHeaderProps> = React.memo(({
  searchQuery,
  onSearchChange,
  displayLayout,
  onToggleLayout,
  showFilters,
  onToggleFilters,
  bulkMode,
  onToggleBulkMode,
  onOpenAddModal,
  onOpenCamera,
  onOpenImportModal,
  shouldGlowAddButton = false,
  itemCount
}) => {
  return (
    <div className="bg-[var(--card-bg)] border-b border-[var(--border-color)] p-4 space-y-3">
      {/* Top Title & Primary Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">My Pantry</h1>
          <p className="text-xs text-[var(--text-secondary)]">{itemCount} items tracked</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleLayout}
            title={displayLayout === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
            className="p-2"
          >
            {displayLayout === 'list' ? (
              <LayoutGrid className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <LayoutList className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </Button>

          <Button
            variant={bulkMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={onToggleBulkMode}
            className="p-2"
            title="Bulk Selection Mode"
          >
            <CheckCircle2 className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenImportModal}
            className="hidden sm:flex items-center gap-1 text-xs"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Import</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenCamera}
            className="flex items-center gap-1.5 text-xs"
          >
            <Camera className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="hidden sm:inline">Scan</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddModal}
            className={`flex items-center gap-1.5 text-xs ${
              shouldGlowAddButton ? 'animate-pulse ring-2 ring-[var(--accent-color)] ring-offset-2' : ''
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </Button>
        </div>
      </div>

      {/* Search Bar & Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pantry items, categories, or locations..."
            className="w-full pl-9 pr-8 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          )}
        </div>

        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          size="sm"
          onClick={onToggleFilters}
          className="p-2.5"
          title="Toggle Filters"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

PantryScannerHeader.displayName = 'PantryScannerHeader';
