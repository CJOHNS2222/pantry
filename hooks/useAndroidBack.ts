import { useEffect } from 'react';

/**
 * Module-level LIFO stack of close callbacks.
 * Each open modal pushes itself; when the Android back button fires,
 * the top entry is popped and its close callback is called.
 */
const _stack: (() => void)[] = [];

/**
 * Close the topmost registered modal.
 * Returns true if a modal was closed, false if the stack was empty.
 */
export function closeTopAndroidModal(): boolean {
  if (_stack.length === 0) return false;
  const close = _stack[_stack.length - 1];
  close();
  return true;
}

/**
 * Register a modal with the Android back button stack.
 * When isOpen is true the modal is pushed onto the stack; when false (or on
 * unmount) it is removed.  Provide a stable onClose reference (useCallback).
 */
export function useAndroidBack(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    _stack.push(onClose);
    return () => {
      // Remove this exact callback from the stack (pop from end for perf)
      const idx = _stack.lastIndexOf(onClose);
      if (idx !== -1) _stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);
}
