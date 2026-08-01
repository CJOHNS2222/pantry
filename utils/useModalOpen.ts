import { useEffect } from 'react';

// Module-level counter so nested modals don't prematurely remove the class
let _count = 0;

// Fallback click/pointerdown blocker for browsers without `inert` support — swallows
// interaction with the background app root while a modal is open (portal'd modals live
// outside #root so this listener only ever intercepts background clicks).
const preventBackgroundInteraction = (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
};

function setAppRootInert(inertOn: boolean) {
  const appRoot = document.getElementById('root');
  if (!appRoot) return;

  const supportsInert = 'inert' in HTMLElement.prototype;
  if (supportsInert) {
    (appRoot as HTMLElement & { inert: boolean }).inert = inertOn;
  } else {
    // Fallback: block pointer interaction + hide from assistive tech.
    if (inertOn) {
      appRoot.setAttribute('aria-hidden', 'true');
      appRoot.addEventListener('click', preventBackgroundInteraction, true);
      appRoot.addEventListener('pointerdown', preventBackgroundInteraction, true);
    } else {
      appRoot.removeAttribute('aria-hidden');
      appRoot.removeEventListener('click', preventBackgroundInteraction, true);
      appRoot.removeEventListener('pointerdown', preventBackgroundInteraction, true);
    }
  }
}

/**
 * Call inside any full-screen modal component (or pass `open` for conditionally-shown modals).
 * Adds `modal-open` to document.body while mounted (or while open=true), which CSS uses
 * to hide the fixed AppHeader and AppNavigation so modals can fill the full viewport.
 *
 * Also marks the app's #root element `inert` (with a non-`inert`-supporting fallback) while
 * any modal is open, so focus/interaction can't escape a portal'd modal into the
 * non-inert background app tree (ui audit F45).
 */
export function useModalOpen(open = true) {
  useEffect(() => {
    if (!open) return;
    _count++;
    if (_count === 1) {
      document.body.classList.add('modal-open');
      setAppRootInert(true);
    }
    return () => {
      _count--;
      if (_count === 0) {
        document.body.classList.remove('modal-open');
        setAppRootInert(false);
      }
    };
  }, [open]);
}
