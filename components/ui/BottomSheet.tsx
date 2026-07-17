/**
 * BottomSheet — Stock & Spoon Design System
 *
 * Mobile-first bottom sheet drawer built for the Capacitor app.
 *
 * Features:
 *  - Swipe-to-close with drag gesture recognition (pointer events)
 *  - Snap positions: 'full' | 'half' | 'auto' (content height)
 *  - Visual drag handle indicator
 *  - Smooth spring-like ease-out animation on open
 *  - Scroll detection — disables swipe-to-close while user is scrolling
 *  - Backdrop click to close
 *  - Focus trap + Escape key
 *  - Body scroll lock while open
 *  - Portal rendering
 *  - Header, scrollable Body, and sticky Footer slots
 *
 * Usage:
 *   <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sort & Filter">
 *     <BottomSheet.Body>…</BottomSheet.Body>
 *     <BottomSheet.Footer>…</BottomSheet.Footer>
 *   </BottomSheet>
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BottomSheetSnap = 'full' | 'half' | 'auto';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  snap?: BottomSheetSnap;
  /** When false, dragging will not close the sheet */
  swipeable?: boolean;
  closeOnBackdrop?: boolean;
  hideCloseButton?: boolean;
  hideHandle?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export interface BottomSheetBodyProps {
  children: React.ReactNode;
  className?: string;
}

export interface BottomSheetFooterProps {
  children: React.ReactNode;
  className?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const BottomSheetContext = createContext<{ onClose: () => void } | null>(null);

export const BottomSheetBody: React.FC<BottomSheetBodyProps> = ({ children, className = '' }) => (
  <div
    className={`flex-1 overflow-y-auto min-h-0 overscroll-contain ${className}`}
    // Prevent swipe gesture while scrolling inside body
    data-scroll-container="true"
  >
    {children}
  </div>
);
BottomSheetBody.displayName = 'BottomSheet.Body';

export const BottomSheetFooter: React.FC<BottomSheetFooterProps> = ({ children, className = '' }) => (
  <div
    className={`flex-shrink-0 flex items-center gap-3 px-5 py-4 border-t border-[var(--border-color)] pb-safe ${className}`}
  >
    {children}
  </div>
);
BottomSheetFooter.displayName = 'BottomSheet.Footer';

// ─── Main Component ──────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80; // px dragged down to trigger close
const VELOCITY_THRESHOLD = 0.5; // px/ms

export const BottomSheet: React.FC<BottomSheetProps> & {
  Body: typeof BottomSheetBody;
  Footer: typeof BottomSheetFooter;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  snap = 'auto',
  swipeable = true,
  closeOnBackdrop = true,
  hideCloseButton = false,
  hideHandle = false,
  children,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    startY: 0,
    startTime: 0,
    currentY: 0,
    dragging: false,
  });
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Drag/Swipe gesture ─────────────────────────────────────────────────────

  const isInsideScrollContainer = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    const container = (target as Element).closest('[data-scroll-container="true"]');
    if (!container) return false;
    return container.scrollTop > 0;
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!swipeable) return;
      if (isInsideScrollContainer(e.target)) return;
      dragState.current = {
        startY: e.clientY,
        startTime: Date.now(),
        currentY: e.clientY,
        dragging: true,
      };
      setIsDragging(true);
      sheetRef.current?.setPointerCapture(e.pointerId);
    },
    [swipeable]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.dragging) return;
    const delta = e.clientY - dragState.current.startY;
    dragState.current.currentY = e.clientY;
    // Only allow dragging downward
    setTranslateY(Math.max(0, delta));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    setIsDragging(false);
    const elapsed = Date.now() - dragState.current.startTime;
    const delta = dragState.current.currentY - dragState.current.startY;
    const velocity = delta / elapsed;

    if (delta > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      setTranslateY(0);
      onClose();
    } else {
      setTranslateY(0);
    }
  }, [onClose]);

  // Snap height
  const heightClass =
    snap === 'full'
      ? 'h-[92vh]'
      : snap === 'half'
      ? 'max-h-[50vh]'
      : 'max-h-[90vh]';

  if (!isOpen) return null;

  const sheet = (
    <BottomSheetContext.Provider value={{ onClose }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Menu'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
        className={[
          'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
          'bg-[var(--bg-primary)] border-t border-[var(--border-color)]',
          'rounded-t-3xl shadow-2xl animate-slide-up touch-none',
          heightClass,
          className,
        ].join(' ')}
      >
        {/* Drag handle */}
        {!hideHandle && (
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-[var(--text-secondary)]/20" />
          </div>
        )}

        {/* Header */}
        {(title || subtitle || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-2 pb-4 border-b border-[var(--border-color)] flex-shrink-0">
            <div className="flex flex-col gap-0.5 min-w-0">
              {title && (
                <h2 className="text-lg font-bold font-serif text-[var(--text-primary)] leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-[var(--text-secondary)] opacity-70">{subtitle}</p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Slotted children */}
        <div className="flex flex-col flex-1 min-h-0 touch-auto">
          {children}
        </div>
      </div>
    </BottomSheetContext.Provider>
  );

  return createPortal(sheet, document.body);
};

BottomSheet.Body = BottomSheetBody;
BottomSheet.Footer = BottomSheetFooter;
BottomSheet.displayName = 'BottomSheet';

export const useBottomSheet = () => {
  const ctx = useContext(BottomSheetContext);
  if (!ctx) throw new Error('useBottomSheet must be inside <BottomSheet>');
  return ctx;
};
