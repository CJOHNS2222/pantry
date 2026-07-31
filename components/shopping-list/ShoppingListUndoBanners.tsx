import React from 'react';
import { Undo2 } from 'lucide-react';

/**
 * Deliberately separate from the global `undoService`/`AppHeader` undo pattern (see F62 audit note).
 * The global undo reverses an already-committed write: an action is persisted to `undoService`'s
 * IndexedDB log, and the header button undoes the single most recent entry after the fact. Shopping-list
 * deletes instead use an optimistic "grace period" pattern (see `remove()`/`undoDelete()` in
 * `ShoppingList.tsx`): the item is removed from the UI immediately but the actual cache/Firestore write is
 * delayed 5s behind a `setTimeout`, tracked per-item in an in-memory `Map`; "undo" just cancels that timer
 * so the delete write never happens at all, and consolidated deletes can leave several timers pending
 * concurrently (hence the item-count banner, unlike the header's single-latest-action button). Routing this
 * through `undoService` would mean always committing the write and reversing it afterward - losing the
 * cancel-before-write optimization and the multi-concurrent-pending-delete support - so it stays local to
 * the shopping list instead of being folded into the global pattern.
 */

interface ShoppingListUndoBannersProps {
  pendingDeleteCount: number;
  onUndoDelete: () => void;
}

export const ShoppingListUndoBanners: React.FC<ShoppingListUndoBannersProps> = ({ pendingDeleteCount, onUndoDelete }) => {
  if (pendingDeleteCount <= 0) return null;

  return (
    <>
      <div className="flex items-center justify-between bg-gray-800 text-white rounded-lg px-3 py-2 text-sm shadow-lg animate-fade-in">
        <span>Item deleted</span>
        <button
          onClick={onUndoDelete}
          className="flex items-center gap-1 ml-4 px-2 py-1 bg-white text-gray-800 rounded text-xs font-bold hover:bg-gray-100 transition-colors"
        >
          <Undo2 className="w-3 h-3" /> Undo
        </button>
      </div>

      <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
        <div className="bg-theme-secondary border border-theme shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 pointer-events-auto">
          <span className="text-sm text-theme-primary">
            {pendingDeleteCount === 1 ? '1 item removed' : `${pendingDeleteCount} items removed`}
          </span>
          <button
            onClick={onUndoDelete}
            className="text-[var(--accent-color)] font-semibold text-sm flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
        </div>
      </div>
    </>
  );
};
