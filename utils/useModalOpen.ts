import { useEffect } from 'react';

// Module-level counter so nested modals don't prematurely remove the class
let _count = 0;

/**
 * Call inside any full-screen modal component (or pass `open` for conditionally-shown modals).
 * Adds `modal-open` to document.body while mounted (or while open=true), which CSS uses
 * to hide the fixed AppHeader and AppNavigation so modals can fill the full viewport.
 */
export function useModalOpen(open = true) {
  useEffect(() => {
    if (!open) return;
    _count++;
    if (_count === 1) document.body.classList.add('modal-open');
    return () => {
      _count--;
      if (_count === 0) document.body.classList.remove('modal-open');
    };
  }, [open]);
}
