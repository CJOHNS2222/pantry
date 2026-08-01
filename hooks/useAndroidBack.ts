import { useEffect, useRef } from 'react';

/**
 * Module-level LIFO stack of registration tokens.
 * Each open modal pushes a stable token (once, on the isOpen false->true
 * transition); when the Android back button fires, the top token's current
 * close callback (read from its mutable ref) is invoked.
 */
type StackEntry = {
  token: object;
  onCloseRef: { current: () => void };
};

const _stack: StackEntry[] = [];

/**
 * Close the topmost registered modal.
 * Returns true if a modal was closed, false if the stack was empty.
 */
export function closeTopAndroidModal(): boolean {
  if (_stack.length === 0) return false;
  const entry = _stack[_stack.length - 1];
  entry.onCloseRef.current();
  return true;
}

/**
 * Register a modal with the Android back button stack.
 *
 * The stack is keyed by a stable per-instance token that is pushed exactly
 * once when `isOpen` transitions to true and removed when it transitions
 * back to false (or on unmount) - re-renders that merely produce a new
 * `onClose` function identity do NOT reorder the stack. The latest
 * `onClose` is always available via a mutable ref, so callers don't need to
 * memoize it.
 */
export function useAndroidBack(isOpen: boolean, onClose: () => void): void {
  const tokenRef = useRef<object | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    if (!tokenRef.current) {
      tokenRef.current = {};
    }
    const token = tokenRef.current;
    _stack.push({ token, onCloseRef });

    return () => {
      const idx = _stack.findIndex((entry) => entry.token === token);
      if (idx !== -1) _stack.splice(idx, 1);
      tokenRef.current = null;
    };
    // Only re-run when isOpen actually flips - onClose identity changes must
    // not reorder the stack.
  }, [isOpen]);
}
