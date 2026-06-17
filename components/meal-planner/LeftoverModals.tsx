import React from 'react';
import { PantryItem } from '../../types';
import LeftoverQuickCapture from '../leftovers/LeftoverQuickCapture';

interface LeftoverModalsProps {
  showLeftoverPrompt: boolean;
  showLeftoverCapture: boolean;
  showLeftoverSwapModal: boolean;
  userId?: string;
  leftoverServings: number;
  leftoverNotes: string;
  leftovers: PantryItem[];
  onSetLeftoverServings: (servings: number) => void;
  onCloseLeftoverPrompt: () => void;
  onOpenLeftoverCapture: () => void;
  onCloseLeftoverCapture: () => void;
  onSavedLeftoverCapture: () => void;
  onSwapWithLeftover: (item: PantryItem) => void;
  onCloseLeftoverSwap: () => void;
}

export const LeftoverModals: React.FC<LeftoverModalsProps> = ({
  showLeftoverPrompt,
  showLeftoverCapture,
  showLeftoverSwapModal,
  userId,
  leftoverServings,
  leftoverNotes,
  leftovers,
  onSetLeftoverServings,
  onCloseLeftoverPrompt,
  onOpenLeftoverCapture,
  onCloseLeftoverCapture,
  onSavedLeftoverCapture,
  onSwapWithLeftover,
  onCloseLeftoverSwap
}) => {
  const openCaptureWithServings = (servings?: number) => {
    if (typeof servings === 'number') {
      onSetLeftoverServings(servings);
    }
    onCloseLeftoverPrompt();
    onOpenLeftoverCapture();
  };

  return (
    <>
      {showLeftoverPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCloseLeftoverPrompt}>
          <div className="bg-theme-primary border border-theme rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Making a lunchbox? 🍱</h3>
            <p className="text-sm text-theme-secondary mb-3">Save leftovers now for quick reminders and expiry tracking.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings(1)}>1 Serving</button>
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings(2)}>2 Servings</button>
              <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings()}>The Rest</button>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded border border-theme" onClick={onCloseLeftoverPrompt}>Skip</button>
              <button className="px-3 py-2 rounded bg-[var(--accent-color)] text-white" onClick={() => openCaptureWithServings()}>Capture</button>
            </div>
          </div>
        </div>
      )}

      {showLeftoverCapture && userId && (
        <div onClick={onCloseLeftoverCapture} style={{ zIndex: 99999 }} className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-theme-primary rounded-xl max-w-xl w-full">
            <LeftoverQuickCapture
              createdBy={userId}
              initialServings={leftoverServings}
              initialNotes={leftoverNotes}
              onSaved={onSavedLeftoverCapture}
              onClose={onCloseLeftoverCapture}
            />
          </div>
        </div>
      )}

      {showLeftoverSwapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCloseLeftoverSwap}>
          <div className="bg-theme-primary border border-theme rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Swap for Leftovers</h3>
            <p className="text-sm text-theme-secondary mb-3">Choose a leftover to replace this planned meal.</p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {leftovers.length === 0 ? (
                <div className="text-sm text-theme-secondary">No leftovers available right now.</div>
              ) : leftovers.map(item => {
                const bestBefore = item.leftoverMeta?.computedBestBefore;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSwapWithLeftover(item)}
                    className="w-full text-left p-3 rounded border border-theme bg-theme-secondary hover:bg-theme-primary transition-colors"
                  >
                    <div className="font-medium text-theme-primary">{item.item}</div>
                    <div className="text-xs text-theme-secondary">
                      {typeof item.leftoverMeta?.servings === 'number' ? `${item.leftoverMeta?.servings} servings` : 'Leftover'}
                      {bestBefore ? ` • best before ${new Date(bestBefore).toLocaleDateString()}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 rounded border border-theme" onClick={onCloseLeftoverSwap}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
