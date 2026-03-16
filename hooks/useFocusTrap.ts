// hooks/useFocusTrap.ts
import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  isActive: boolean;
  restoreFocus?: boolean;
}

export function useFocusTrap(options: UseFocusTrapOptions) {
  const { isActive, restoreFocus = true } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Store the currently focused element
    if (restoreFocus) {
      previouslyFocusedElementRef.current = document.activeElement;
    }

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ];

      return Array.from(
        container.querySelectorAll(focusableSelectors.join(', '))
      ) as HTMLElement[];
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Focus the first focusable element when the trap becomes active
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      setTimeout(() => focusableElements[0].focus(), 0);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (restoreFocus && previouslyFocusedElementRef.current instanceof HTMLElement) {
        setTimeout(() => (previouslyFocusedElementRef.current as HTMLElement)?.focus(), 0);
      }
    };
  }, [isActive, restoreFocus]);

  return containerRef;
}