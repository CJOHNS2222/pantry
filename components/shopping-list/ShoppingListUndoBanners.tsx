import React from 'react';
import { Undo2 } from 'lucide-react';

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
