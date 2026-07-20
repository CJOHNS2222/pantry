import { useCallback, useEffect } from 'react';

interface ModalStackState {
  showRecipeModal: boolean;
  showRecipeSearch: boolean;
  showAddMealDialog: boolean;
  showLeftoverPrompt: boolean;
  showLeftoverCapture: boolean;
  showLeftoverSwapModal: boolean;
}

interface ModalStackClosers {
  closeRecipeModal: () => void;
  closeRecipeSearch: () => void;
  closeAddMealDialog: () => void;
  closeLeftoverPrompt: () => void;
  closeLeftoverCapture: () => void;
  closeLeftoverSwapModal: () => void;
}

export const useMealPlannerModalStack = (state: ModalStackState, closers: ModalStackClosers) => {
  const closeTopModal = useCallback(() => {
    if (state.showLeftoverSwapModal) {
      closers.closeLeftoverSwapModal();
      return;
    }
    if (state.showLeftoverCapture) {
      closers.closeLeftoverCapture();
      return;
    }
    if (state.showLeftoverPrompt) {
      closers.closeLeftoverPrompt();
      return;
    }
    if (state.showAddMealDialog) {
      closers.closeAddMealDialog();
      return;
    }
    if (state.showRecipeSearch) {
      closers.closeRecipeSearch();
      return;
    }
    if (state.showRecipeModal) {
      closers.closeRecipeModal();
    }
  }, [
    state.showLeftoverSwapModal,
    state.showLeftoverCapture,
    state.showLeftoverPrompt,
    state.showAddMealDialog,
    state.showRecipeSearch,
    state.showRecipeModal,
    closers.closeLeftoverSwapModal,
    closers.closeLeftoverCapture,
    closers.closeLeftoverPrompt,
    closers.closeAddMealDialog,
    closers.closeRecipeSearch,
    closers.closeRecipeModal,
  ]);

  const isAnyModalOpen =
    state.showRecipeModal ||
    state.showRecipeSearch ||
    state.showAddMealDialog ||
    state.showLeftoverPrompt ||
    state.showLeftoverCapture ||
    state.showLeftoverSwapModal;

  useEffect(() => {
    if (!isAnyModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalOpen, closeTopModal]);

  return {
    closeTopModal,
    isAnyModalOpen,
  };
};
