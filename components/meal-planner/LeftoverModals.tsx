import React from 'react';
import { PantryItem } from '../../types';
import LeftoverQuickCapture from '../leftovers/LeftoverQuickCapture';
import { Modal } from '../ui/Modal';

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
      <Modal isOpen={showLeftoverPrompt} onClose={onCloseLeftoverPrompt} title="Making a lunchbox? 🍱" size="sm">
        <Modal.Body>
          <p className="text-sm text-theme-secondary mb-3">Save leftovers now for quick reminders and expiry tracking.</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings(1)}>1 Serving</button>
            <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings(2)}>2 Servings</button>
            <button className="px-3 py-2 rounded border border-theme bg-theme-secondary hover:bg-theme-primary" onClick={() => openCaptureWithServings()}>The Rest</button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="px-3 py-2 rounded border border-theme" onClick={onCloseLeftoverPrompt}>Skip</button>
          <button className="px-3 py-2 rounded bg-[var(--accent-color)] text-[var(--accent-text,white)]" onClick={() => openCaptureWithServings()}>Capture</button>
        </Modal.Footer>
      </Modal>

      {showLeftoverCapture && userId && (
        <LeftoverQuickCapture
          createdBy={userId}
          initialServings={leftoverServings}
          initialNotes={leftoverNotes}
          onSaved={onSavedLeftoverCapture}
          onClose={onCloseLeftoverCapture}
        />
      )}

      <Modal isOpen={showLeftoverSwapModal} onClose={onCloseLeftoverSwap} title="Swap for Leftovers">
        <Modal.Body>
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
        </Modal.Body>
        <Modal.Footer>
          <button className="px-3 py-2 rounded border border-theme" onClick={onCloseLeftoverSwap}>Cancel</button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
