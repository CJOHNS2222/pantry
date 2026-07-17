/**
 * Input — Stock & Spoon Design System
 *
 * Polymorphic form input that handles text, email, password, number,
 * search, and textarea modes with consistent theming, validation states,
 * accessible labels, helper text, character counts, and leading/trailing
 * icon slots.
 *
 * Usage:
 *   <Input label="Item name" placeholder="e.g. Chicken breast" />
 *   <Input label="Search pantry" type="search" leadingIcon={<Search />} clearable />
 *   <Input label="Notes" as="textarea" rows={4} maxLength={500} showCount />
 *   <Input label="Email" type="email" error="Please enter a valid email address" />
 */

import React, { forwardRef, useState, useId } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type InputAs = 'input' | 'textarea';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'> {
  /** Rendered label above the field */
  label?: string;
  /** Helper/hint text below the field */
  helper?: string;
  /** Validation error message — turns field red when truthy */
  error?: string;
  /** Icon rendered inside the left slot */
  leadingIcon?: React.ReactNode;
  /** Icon or element rendered inside the right slot */
  trailingIcon?: React.ReactNode;
  /** Show a clear (✕) button when field has content */
  clearable?: boolean;
  /** Callback when clear button is pressed */
  onClear?: () => void;
  /** Show character count below (requires maxLength) */
  showCount?: boolean;
  /** Render a <textarea> instead of <input> */
  as?: InputAs;
  /** Number of rows when as="textarea" */
  rows?: number;
  /** Optional callback when value changes, mirrors onChange for controlled forms */
  onValueChange?: (value: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (
    {
      label,
      helper,
      error,
      leadingIcon,
      trailingIcon,
      clearable,
      onClear,
      showCount,
      as: Component = 'input',
      rows = 3,
      type = 'text',
      maxLength,
      value,
      defaultValue,
      onChange,
      onValueChange,
      disabled,
      className = '',
      id: idProp,
      ...rest
    },
    ref
  ) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    const [showPassword, setShowPassword] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue?.toString() ?? '');

    const isControlled = value !== undefined;
    const currentValue = isControlled ? String(value ?? '') : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!isControlled) setInternalValue(e.target.value);
      onChange?.(e as React.ChangeEvent<HTMLInputElement>);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      if (!isControlled) setInternalValue('');
      onClear?.();
    };

    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const hasError = !!error;
    const hasLeading = !!leadingIcon;
    const hasTrailing = !!trailingIcon || clearable || isPassword;

    const borderClass = hasError
      ? 'border-rose-500/70 focus-within:border-rose-500'
      : 'border-[var(--border-color)] focus-within:border-[var(--accent-color)]';

    const wrapperClass = [
      'relative flex items-center rounded-xl border transition-all duration-150 bg-theme-secondary/30',
      'focus-within:ring-2 focus-within:ring-[var(--accent-color)]/20',
      borderClass,
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const inputClass = [
      'flex-1 min-w-0 bg-transparent text-sm text-theme-primary placeholder:text-theme-secondary/50',
      'focus:outline-none disabled:cursor-not-allowed',
      Component === 'textarea' ? 'py-3 resize-none leading-relaxed' : 'h-10',
      hasLeading ? 'pl-9' : 'pl-3',
      hasTrailing ? 'pr-9' : 'pr-3',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const charCount = currentValue.length;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold text-theme-secondary uppercase tracking-wider pl-0.5"
          >
            {label}
          </label>
        )}

        <div className={wrapperClass}>
          {/* Leading icon */}
          {hasLeading && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary/60 pointer-events-none flex-shrink-0"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}

          {/* The actual input / textarea */}
          {Component === 'textarea' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={id}
              rows={rows}
              maxLength={maxLength}
              value={isControlled ? value : internalValue}
              disabled={disabled}
              onChange={handleChange}
              className={inputClass}
              aria-invalid={hasError}
              aria-describedby={
                [error ? `${id}-error` : null, helper ? `${id}-helper` : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              id={id}
              type={inputType}
              maxLength={maxLength}
              value={isControlled ? value : internalValue}
              disabled={disabled}
              onChange={handleChange}
              className={inputClass}
              aria-invalid={hasError}
              aria-describedby={
                [error ? `${id}-error` : null, helper ? `${id}-helper` : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          )}

          {/* Trailing action slot */}
          {hasTrailing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {clearable && currentValue.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-theme-secondary/50 hover:text-theme-secondary transition-colors"
                  aria-label="Clear input"
                  tabIndex={0}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {isPassword && (
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-theme-secondary/50 hover:text-theme-secondary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              )}
              {trailingIcon && (
                <span className="text-theme-secondary/60 pointer-events-none" aria-hidden="true">
                  {trailingIcon}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Footer row: error or helper + optional char count */}
        <div className="flex items-start justify-between gap-2 min-h-[1rem]">
          <div className="flex-1">
            {hasError && (
              <p id={`${id}-error`} role="alert" className="text-[11px] text-rose-500 font-medium">
                {error}
              </p>
            )}
            {!hasError && helper && (
              <p id={`${id}-helper`} className="text-[11px] text-theme-secondary/60">
                {helper}
              </p>
            )}
          </div>
          {showCount && maxLength && (
            <p
              className={`text-[11px] flex-shrink-0 tabular-nums ${
                charCount >= maxLength
                  ? 'text-rose-500 font-semibold'
                  : charCount >= maxLength * 0.85
                  ? 'text-amber-500'
                  : 'text-theme-secondary/40'
              }`}
              aria-live="polite"
            >
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';
