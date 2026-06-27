import { useEffect, useState } from 'react';

/**
 * Hook to detect virtual keyboard visibility on mobile devices using visualViewport,
 * and automatically center focused input/textarea elements above the keyboard.
 */
export function useKeyboard(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (!window.visualViewport) return;
      const screenHeight = window.screen.height;
      const currentHeight = window.visualViewport.height;
      
      // If the visual viewport size is less than 85% of screen height,
      // and an input is focused, it indicates the soft keyboard is visible.
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true'
      );
      
      const isVisible = (currentHeight < screenHeight * 0.85) && isInputActive;
      setIsKeyboardVisible(!!isVisible);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        setIsKeyboardVisible(true);
        // Delay slightly to let the keyboard animation complete,
        // then scroll the input into the center of the visual viewport.
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    const handleFocusOut = () => {
      // Delay slightly to check if focus moved to another input
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isInputActive = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (!isInputActive) {
          setIsKeyboardVisible(false);
        }
      }, 100);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardVisible;
}
