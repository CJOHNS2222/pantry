import { useEffect, useState } from 'react';

/**
 * Hook to detect virtual keyboard visibility on mobile devices using visualViewport,
 * and automatically center focused input/textarea elements above the keyboard.
 */
export function useKeyboard(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      const screenHeight = window.screen.height;
      const currentHeight = window.visualViewport.height;
      
      // If the visual viewport size is less than 75% of screen height,
      // it indicates the soft keyboard is visible.
      const isVisible = currentHeight < screenHeight * 0.75;
      setIsKeyboardVisible(isVisible);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        // Delay slightly to let the keyboard animation complete,
        // then scroll the input into the center of the visual viewport.
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    document.addEventListener('focusin', handleFocusIn);

    // Initial check
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return isKeyboardVisible;
}
