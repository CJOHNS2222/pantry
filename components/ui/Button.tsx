/**
 * Button — Stock & Spoon Design System
 *
 * Production-grade button covering all interactive states:
 * loading, disabled, icon-only, icon+label, left/right icon,
 * full-width, and all semantic variants that respect the
 * `--accent-color` CSS custom property.
 *
 * Usage:
 *   <Button variant="primary" size="md" onClick={handleSave}>Save Recipe</Button>
 *   <Button variant="primary" loading>Saving…</Button>
 *   <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} iconOnly aria-label="Delete item" />
 *   <Button variant="danger" fullWidth>Delete Account</Button>
 */

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'   // Filled accent — primary CTA
  | 'secondary' // Bordered accent — secondary action
  | 'ghost'     // No border/bg — tertiary / icon buttons
  | 'danger'    // Destructive / delete actions
  | 'success'   // Confirmation / completion actions
  | 'muted';    // Subdued utility actions

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Show a spinner and disable the button while true */
  loading?: boolean;
  /** Stretch to fill the parent's width */
  fullWidth?: boolean;
  /** An icon element rendered before the label */
  leadingIcon?: React.ReactNode;
  /** An icon element rendered after the label */
  trailingIcon?: React.ReactNode;
  /**
   * When true, renders a square button sized to just the icon.
   * Requires an aria-label for accessibility.
   */
  iconOnly?: boolean;
  /** Pass a single icon when using iconOnly mode */
  icon?: React.ReactNode;
}

// ─── Style Maps ─────────────────────────────────────────────────────────────

const VARIANT_BASE: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-color)] text-white border-transparent hover:bg-[var(--accent-color)]/90 active:bg-[var(--accent-color)]/80 shadow-sm',
  secondary:
    'bg-transparent text-[var(--accent-color)] border-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 active:bg-[var(--accent-color)]/20',
  ghost:
    'bg-transparent text-theme-secondary border-transparent hover:bg-theme-secondary/30 active:bg-theme-secondary/50',
  danger:
    'bg-rose-600 text-white border-transparent hover:bg-rose-700 active:bg-rose-800 shadow-sm',
  success:
    'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 active:bg-emerald-800 shadow-sm',
  muted:
    'bg-theme-secondary/40 text-theme-secondary border-theme hover:bg-theme-secondary/60 active:bg-theme-secondary/80',
};

const SIZE_CLASSES: Record<ButtonSize, { button: string; iconOnly: string; spinnerSize: string }> = {
  xs: { button: 'h-7 px-2.5 text-[10px] rounded-lg gap-1', iconOnly: 'h-7 w-7 rounded-lg', spinnerSize: 'w-3 h-3' },
  sm: { button: 'h-8 px-3 text-xs rounded-xl gap-1.5', iconOnly: 'h-8 w-8 rounded-xl', spinnerSize: 'w-3.5 h-3.5' },
  md: { button: 'h-10 px-4 text-sm rounded-xl gap-2', iconOnly: 'h-10 w-10 rounded-xl', spinnerSize: 'w-4 h-4' },
  lg: { button: 'h-12 px-6 text-base rounded-2xl gap-2.5', iconOnly: 'h-12 w-12 rounded-2xl', spinnerSize: 'w-5 h-5' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      iconOnly = false,
      icon,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const sizes = SIZE_CLASSES[size];
    const variantClass = VARIANT_BASE[variant];
    const sizeClass = iconOnly ? sizes.iconOnly : sizes.button;

    const base = [
      'inline-flex items-center justify-center font-semibold border transition-all duration-150 select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      variantClass,
      sizeClass,
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const spinnerClass = sizes.spinnerSize;

    return (
      <button ref={ref} disabled={isDisabled} className={base} {...rest}>
        {loading ? (
          <>
            <Loader2 className={`${spinnerClass} animate-spin flex-shrink-0`} aria-hidden="true" />
            {!iconOnly && children && (
              <span className="opacity-75">{children}</span>
            )}
          </>
        ) : (
          <>
            {leadingIcon && (
              <span className="flex-shrink-0" aria-hidden="true">{leadingIcon}</span>
            )}
            {iconOnly && icon ? (
              <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
            ) : (
              children && <span>{children}</span>
            )}
            {trailingIcon && (
              <span className="flex-shrink-0" aria-hidden="true">{trailingIcon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
