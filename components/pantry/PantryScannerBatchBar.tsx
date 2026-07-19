import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface PantryScannerBatchBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkMoveLocation: (location: string) => void;
  onCancelBulkMode: () => void;
}

export const PantryScannerBatchBar: React.FC<PantryScannerBatchBarProps> = React.memo(({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkMoveLocation,
  onCancelBulkMode
}) => {
  if (selectedCount === 0) {
    return (
      <div className="bg-[var(--card-bg)] border-b border-[var(--border-color)] p-3 flex items-center justify-between animate-fadeIn">
        <span className="text-sm text-[var(--text-secondary)]">Tap items to select for bulk actions</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select All ({totalCount})
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelBulkMode}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-30 bg-[var(--accent-color)] text-white p-3 shadow-lg flex items-center justify-between animate-slideDown">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{selectedCount} Selected</span>
        {selectedCount < totalCount ? (
          <button onClick={onSelectAll} className="text-xs underline text-white/80 hover:text-white">
            Select All
          </button>
        ) : (
          <button onClick={onDeselectAll} className="text-xs underline text-white/80 hover:text-white">
            Deselect All
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          onChange={(e) => {
            if (e.target.value) {
              onBulkMoveLocation(e.target.value);
              e.target.value = '';
            }
          }}
          className="bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30 focus:outline-none"
          defaultValue=""
        >
          <option value="" disabled className="bg-[var(--card-bg)] text-[var(--text-primary)]">Move to...</option>
          <option value="pantry" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Pantry</option>
          <option value="fridge" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Fridge</option>
          <option value="freezer" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Freezer</option>
          <option value="spices" className="bg-[var(--card-bg)] text-[var(--text-primary)]">Spices</option>
        </select>

        <button
          onClick={onBulkDelete}
          className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded flex items-center gap-1 text-xs transition-colors"
          title="Delete selected"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        <button
          onClick={onCancelBulkMode}
          className="text-xs text-white/80 hover:text-white px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

PantryScannerBatchBar.displayName = 'PantryScannerBatchBar';
