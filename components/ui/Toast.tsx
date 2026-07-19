/**
 * Toast — Stock & Spoon Design System
 *
 * In-app toast notification system with:
 *  - useToast() hook for imperative show/dismiss API
 *  - ToastContainer rendered via portal at the top/bottom of the screen
 *  - Four semantic variants: success, error, warning, info
 *  - Auto-dismiss with configurable duration per toast
 *  - Pause on hover (timer pauses while mouse is over the toast)
 *  - Action button support for inline CTAs
 *  - ARIA live region announcements
 *  - Stacking with slide-in / slide-out animations
 *  - Max-stack limit to prevent overflow (oldest is evicted)
 *
 * Setup (add once at App.tsx level):
 *   <ToastContainer />
 *
 * Usage from any component:
 *   const toast = useToast();
 *   toast.success('Recipe saved!');
 *   toast.error('Something went wrong.', { duration: 8000 });
 *   toast.info('Syncing household…', { action: { label: 'Dismiss', onClick: () => {} } });
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. Pass Infinity to persist. */
  duration?: number;
  /** Optional inline CTA */
  action?: ToastAction;
}

interface ToastItem extends Required<ToastOptions> {
  id: string;
  variant: ToastVariant;
  message: string;
  removing: boolean;
}

export interface ToastContextValue {
  success: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  warning: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastContainerProps {
  position?: ToastPosition;
  maxToasts?: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 4500;
const REMOVE_ANIMATION_DURATION = 320;
const MAX_TOASTS = 5;

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  success: {
    icon: CheckCircle2,
    colorClass: 'text-emerald-400',
    bgClass: 'border-emerald-500/30 bg-emerald-500/10',
  },
  error: {
    icon: XCircle,
    colorClass: 'text-rose-400',
    bgClass: 'border-rose-500/30 bg-rose-500/10',
  },
  warning: {
    icon: AlertTriangle,
    colorClass: 'text-amber-400',
    bgClass: 'border-amber-500/30 bg-amber-500/10',
  },
  info: {
    icon: Info,
    colorClass: 'text-sky-400',
    bgClass: 'border-sky-500/30 bg-sky-500/10',
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Single Toast Item ───────────────────────────────────────────────────────

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  position: ToastPosition;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss, position }) => {
  const { icon: Icon, colorClass, bgClass } = VARIANT_CONFIG[toast.variant];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(Date.now());

  const startTimer = useCallback(() => {
    if (toast.duration === Infinity) return;
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingRef.current);
    startedAtRef.current = Date.now();
  }, [toast.duration, toast.id, onDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startedAtRef.current;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const slideClass =
    position === 'top'
      ? toast.removing
        ? 'opacity-0 -translate-y-3 scale-95'
        : 'opacity-100 translate-y-0 scale-100'
      : toast.removing
      ? 'opacity-0 translate-y-3 scale-95'
      : 'opacity-100 translate-y-0 scale-100';

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      className={[
        'flex items-start gap-3 w-full max-w-sm px-4 py-3.5',
        'rounded-2xl border shadow-xl backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        bgClass,
        slideClass,
        // Glass base
        'bg-[var(--bg-secondary)]/80',
      ].join(' ')}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colorClass}`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug break-words">
          {toast.message}
        </p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action.onClick();
              onDismiss(toast.id);
            }}
            className={`mt-1.5 text-xs font-semibold underline underline-offset-2 ${colorClass} hover:opacity-80 transition-opacity`}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-[var(--text-secondary)]/50 hover:text-[var(--text-secondary)] transition-colors -mt-0.5 -mr-1"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

// ─── Provider + Container ─────────────────────────────────────────────────────

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}> = ({ children, position = 'bottom', maxToasts = MAX_TOASTS }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (variant: ToastVariant, message: string, opts: ToastOptions = {}): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        variant,
        message,
        duration: opts.duration ?? DEFAULT_DURATION,
        action: opts.action ?? { label: '', onClick: () => {} },
        removing: false,
      };

      setToasts((prev) => {
        const next = [...prev, item];
        // Evict oldest if over limit
        if (next.length > maxToasts) return next.slice(next.length - maxToasts);
        return next;
      });

      return id;
    },
    [maxToasts]
  );

  const dismiss = useCallback((id: string) => {
    // Mark as removing first (triggers exit animation)
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, REMOVE_ANIMATION_DURATION);
  }, []);

  const dismissAll = useCallback(() => {
    setToasts((prev) => prev.map((t) => ({ ...t, removing: true })));
    setTimeout(() => setToasts([]), REMOVE_ANIMATION_DURATION);
  }, []);

  const value: ToastContextValue = {
    success: (msg, opts) => addToast('success', msg, opts),
    error: (msg, opts) => addToast('error', msg, opts),
    warning: (msg, opts) => addToast('warning', msg, opts),
    info: (msg, opts) => addToast('info', msg, opts),
    dismiss,
    dismissAll,
  };

  const positionClass =
    position === 'top'
      ? 'top-safe top-4 items-start flex-col'
      : 'bottom-safe bottom-[110px] items-end flex-col-reverse';

  const container = toasts.length > 0
    ? createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          className={`fixed left-1/2 -translate-x-1/2 z-[9999] flex gap-2 w-full max-w-sm px-4 pointer-events-none ${positionClass}`}
        >
          {toasts.map((t) => (
            <div key={t.id} className="w-full pointer-events-auto">
              <ToastCard toast={t} onDismiss={dismiss} position={position} />
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {container}
    </ToastContext.Provider>
  );
};

ToastProvider.displayName = 'ToastProvider';
