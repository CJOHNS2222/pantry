/**
 * ConfirmDialog — Stock & Spoon Design System
 *
 * A promise-based confirm dialog built on top of Modal.
 * Replaces `window.confirm()` with a branded, accessible UI.
 *
 *  - Imperative API via useConfirm() hook (no JSX wiring needed)
 *  - Declarative API via <ConfirmDialog> for controlled use
 *  - Variant-aware: destructive actions show a red confirm button
 *  - Keyboard accessible (Enter = confirm, Escape = cancel)
 *  - Auto-focuses the safe (cancel) button for destructive dialogs
 *
 * Usage (imperative – recommended):
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete item?',
 *     description: 'This action cannot be undone.',
 *     variant: 'danger',
 *     confirmLabel: 'Delete',
 *   });
 *   if (ok) deleteItem();
 *
 * Setup (add once near app root):
 *   <ConfirmDialogProvider />
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Modal, ModalBody, ModalFooter } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Trash2, CheckCircle2, HelpCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConfirmVariant = 'default' | 'danger' | 'success';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

type ConfirmResolver = (result: boolean) => void;

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: ConfirmResolver;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmDialogProvider>');
  return ctx.confirm;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  ConfirmVariant,
  { icon: React.ElementType; iconClass: string; buttonVariant: 'primary' | 'danger' | 'success' }
> = {
  default: {
    icon: HelpCircle,
    iconClass: 'text-[var(--accent-color)]',
    buttonVariant: 'primary',
  },
  danger: {
    icon: Trash2,
    iconClass: 'text-rose-500',
    buttonVariant: 'danger',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    buttonVariant: 'success',
  },
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const ConfirmDialogProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPending({ options, resolve });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const options = pending?.options;
  const variant = options?.variant ?? 'default';
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      <Modal
        isOpen={!!pending}
        onClose={() => handleClose(false)}
        size="sm"
        closeOnBackdrop={false}
        hideCloseButton
        aria-label={options?.title ?? 'Confirm action'}
      >
        <ModalBody padding="md">
          <div className="flex flex-col items-center text-center gap-4 pt-2">
            {/* Icon */}
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                variant === 'danger'
                  ? 'bg-rose-500/10 border border-rose-500/20'
                  : variant === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20'
              }`}
              aria-hidden="true"
            >
              <Icon className={`w-7 h-7 ${config.iconClass}`} />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold font-serif text-[var(--text-primary)]">
                {options?.title}
              </h3>
              {options?.description && (
                <p className="text-sm text-[var(--text-secondary)] opacity-75 leading-relaxed">
                  {options.description}
                </p>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter align="between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
            autoFocus={variant === 'danger'}
          >
            {options?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={config.buttonVariant}
            size="sm"
            onClick={() => handleClose(true)}
            autoFocus={variant !== 'danger'}
          >
            {options?.confirmLabel ?? 'Confirm'}
          </Button>
        </ModalFooter>
      </Modal>
    </ConfirmContext.Provider>
  );
};

ConfirmDialogProvider.displayName = 'ConfirmDialogProvider';

// ─── Standalone "warning" icon for use in other contexts ──────────────────────

export { AlertTriangle as WarningIcon };
