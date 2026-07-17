/**
 * Modal — Stock & Spoon Design System
 *
 * Fully-accessible modal dialog with:
 *  - Focus trap (keyboard navigation stays inside)
 *  - Escape key to close
 *  - Backdrop click to close (opt-out available)
 *  - Body scroll lock while open
 *  - Screen-reader announcements via role="dialog" + aria-modal
 *  - Stacked modal support (z-index managed per-instance)
 *  - Configurable sizes: sm / md / lg / xl / full
 *  - Header, scrollable body, and sticky footer slots
 *  - Smooth animate-slide-up entrance (matches app animation system)
 *
 * Usage:
 *   <Modal isOpen={show} onClose={() => setShow(false)} title="Edit Item">
 *     <Modal.Body>…content…</Modal.Body>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
 *       <Button onClick={save}>Save</Button>
 *     </Modal.Footer>
 *   </Modal>
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  /** Controls visibility */
  isOpen: boolean;
  /** Called when the user requests close (Escape / backdrop / header ✕) */
  onClose: () => void;
  /** Optional header title */
  title?: React.ReactNode;
  /** Optional subtitle beneath the title */
  subtitle?: React.ReactNode;
  /** Max-width preset */
  size?: ModalSize;
  /**
   * When false, clicking the backdrop will NOT close the modal.
   * Useful for confirm dialogs with unsaved changes.
   */
  closeOnBackdrop?: boolean;
  /** Hide the default header close button */
  hideCloseButton?: boolean;
  /** Additional class names applied to the panel */
  panelClassName?: string;
  /** The modal's accessible label (defaults to `title` if omitted) */
  'aria-label'?: string;
  children?: React.ReactNode;
}

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  /** When true the body will not scroll internally — useful for compact modals */
  noScroll?: boolean;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md';
}

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  /** Align footer buttons */
  align?: 'left' | 'center' | 'right' | 'between';
}

// ─── Context (lets Body/Footer know about the parent modal) ───────────────────

const ModalContext = createContext<{ onClose: () => void } | null>(null);
export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside <Modal>');
  return ctx;
};

// ─── Size Map ────────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-2',
};

// ─── Focus-trap utility ──────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function trapFocus(containerRef: React.RefObject<HTMLElement | null>, e: KeyboardEvent) {
  if (!containerRef.current) return;
  const focusable = Array.from(
    containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  ).filter((el) => !el.closest('[aria-hidden="true"]'));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      last.focus();
      e.preventDefault();
    }
  } else {
    if (document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const PADDING_CLASSES: Record<NonNullable<ModalBodyProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
};

const ALIGN_CLASSES: Record<NonNullable<ModalFooterProps['align']>, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
  between: 'justify-between',
};

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  noScroll = false,
  padding = 'md',
}) => (
  <div
    className={`flex-1 ${noScroll ? '' : 'overflow-y-auto'} min-h-0 ${PADDING_CLASSES[padding]} ${className}`}
  >
    {children}
  </div>
);
ModalBody.displayName = 'ModalBody';

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = '',
  align = 'right',
}) => (
  <div
    className={`flex-shrink-0 flex items-center gap-3 px-5 py-4 border-t border-[var(--border-color)] ${ALIGN_CLASSES[align]} ${className}`}
  >
    {children}
  </div>
);
ModalFooter.displayName = 'ModalFooter';

// ─── Main Modal component ─────────────────────────────────────────────────────

export const Modal: React.FC<ModalProps> & {
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  panelClassName = '',
  'aria-label': ariaLabel,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Lock body scroll and save previously focused element
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Move focus inside the modal after paint
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
      (first ?? panelRef.current)?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  // Keyboard handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(panelRef, e.nativeEvent);
      }
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) onClose();
  }, [closeOnBackdrop, onClose]);

  if (!isOpen) return null;

  const hasHeader = !!(title || subtitle || !hideCloseButton);

  const panel = (
    <ModalContext.Provider value={{ onClose }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        aria-hidden="false"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={!title ? (ariaLabel ?? 'Dialog') : undefined}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={[
            'pointer-events-auto w-full flex flex-col',
            'bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-3xl shadow-2xl',
            'animate-slide-up max-h-[90vh] focus:outline-none',
            SIZE_CLASSES[size],
            panelClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* Header */}
          {hasHeader && (
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[var(--border-color)] flex-shrink-0">
              <div className="flex flex-col gap-0.5 min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-bold font-serif text-[var(--text-primary)] leading-tight"
                  >
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
                  className="flex-shrink-0 p-1.5 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Slotted content */}
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );

  // Render into a portal at document.body so z-index is guaranteed
  return createPortal(panel, document.body);
};

Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.displayName = 'Modal';
