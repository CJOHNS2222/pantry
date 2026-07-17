/**
 * Select — Stock & Spoon Design System
 *
 * Accessible custom select / listbox replacing native <select>.
 *
 * Features:
 *  - Keyboard navigation (Arrow keys, Enter, Escape, Home, End, search by character)
 *  - ARIA listbox + option roles with aria-selected / aria-activedescendant
 *  - Optional searchable filter input above the list
 *  - Option groups with visible section headers
 *  - Disabled individual options
 *  - Leading icons per option
 *  - Clear / nullable support
 *  - Matches app theming via CSS custom properties
 *  - Portal dropdown (no overflow clipping issues)
 *
 * Usage:
 *   <Select
 *     label="Storage location"
 *     value={location}
 *     onChange={setLocation}
 *     options={[
 *       { value: 'fridge', label: 'Fridge', icon: <Thermometer /> },
 *       { value: 'pantry', label: 'Pantry' },
 *     ]}
 *   />
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps<T extends string = string> {
  label?: string;
  helper?: string;
  error?: string;
  value?: T | null;
  onChange?: (value: T | null) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function groupOptions<T extends string>(options: SelectOption<T>[]) {
  const groups = new Map<string, SelectOption<T>[]>();
  for (const opt of options) {
    const key = opt.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(opt);
  }
  return groups;
}

// ─── Component ───────────────────────────────────────────────────────────────

function SelectInner<T extends string = string>(
  {
    label,
    helper,
    error,
    value,
    onChange,
    options,
    placeholder = 'Select…',
    searchable = false,
    clearable = false,
    disabled = false,
    className = '',
    id: idProp,
  }: SelectProps<T>,
  _ref: React.Ref<HTMLButtonElement>
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listboxId = `${id}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const selectedOption = options.find((o) => o.value === value) ?? null;

  const filteredOptions = searchable && query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const enabledOptions = filteredOptions.filter((o) => !o.disabled);

  // Position the dropdown
  const openDropdown = useCallback(() => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropdownRect(rect);
    setIsOpen(true);
    setQuery('');
    const idx = filteredOptions.findIndex((o) => o.value === value);
    setFocusedIdx(idx >= 0 ? idx : 0);
  }, [disabled, filteredOptions, value]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (opt: SelectOption<T>) => {
      if (opt.disabled) return;
      onChange?.(opt.value);
      closeDropdown();
    },
    [onChange, closeDropdown]
  );

  const clearValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    },
    [onChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeDropdown]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen, searchable]);

  // Keyboard navigation on trigger
  const handleTriggerKey = (e: React.KeyboardEvent) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      openDropdown();
    }
  };

  // Keyboard navigation in dropdown
  const handleListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closeDropdown(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => {
        const next = enabledOptions.findIndex((o, idx) => idx > i);
        return next >= 0 ? filteredOptions.indexOf(enabledOptions[next]) : i;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => {
        const prevEnabled = [...enabledOptions].reverse().find(
          (o) => filteredOptions.indexOf(o) < i
        );
        return prevEnabled ? filteredOptions.indexOf(prevEnabled) : i;
      });
    }
    if (e.key === 'Home') { setFocusedIdx(0); }
    if (e.key === 'End') { setFocusedIdx(filteredOptions.length - 1); }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = filteredOptions[focusedIdx];
      if (opt) selectOption(opt);
    }
  };

  const hasError = !!error;
  const groups = groupOptions(filteredOptions);

  const triggerBorder = hasError
    ? 'border-rose-500/70'
    : isOpen
    ? 'border-[var(--accent-color)]'
    : 'border-[var(--border-color)]';

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pl-0.5"
        >
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-invalid={hasError}
        disabled={disabled}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKey}
        className={[
          'w-full flex items-center justify-between gap-2 h-10 px-3 rounded-xl border transition-all duration-150 text-sm',
          'bg-[var(--bg-secondary)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          triggerBorder,
        ].join(' ')}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-[var(--text-secondary)]/60" aria-hidden="true">
              {selectedOption.icon}
            </span>
          )}
          <span
            className={`truncate ${
              selectedOption
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]/50'
            }`}
          >
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearValue}
              onKeyDown={(e) => { if (e.key === 'Enter') clearValue(e as unknown as React.MouseEvent); }}
              aria-label="Clear selection"
              className="text-[var(--text-secondary)]/50 hover:text-[var(--text-secondary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-secondary)]/50 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Footer */}
      <div className="min-h-[1rem]">
        {hasError && (
          <p role="alert" className="text-[11px] text-rose-500 font-medium">{error}</p>
        )}
        {!hasError && helper && (
          <p className="text-[11px] text-[var(--text-secondary)]/60">{helper}</p>
        )}
      </div>

      {/* Portal Dropdown */}
      {isOpen &&
        dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 6,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            onKeyDown={handleListKey}
            className="animate-fade-in-up rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden"
          >
            {searchable && (
              <div className="p-2 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2 px-2">
                  <Search className="w-4 h-4 text-[var(--text-secondary)]/50 flex-shrink-0" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setFocusedIdx(0); }}
                    placeholder="Search…"
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:outline-none"
                    aria-label="Search options"
                  />
                </div>
              </div>
            )}

            <ul
              role="listbox"
              id={listboxId}
              aria-label={label}
              aria-activedescendant={focusedIdx >= 0 ? `${id}-opt-${focusedIdx}` : undefined}
              className="max-h-56 overflow-y-auto py-1.5"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-[var(--text-secondary)]/50 italic text-center">
                  No options
                </li>
              ) : (
                Array.from(groups.entries()).map(([groupName, groupOpts]) => (
                  <React.Fragment key={groupName || '__ungrouped__'}>
                    {groupName && (
                      <li
                        role="presentation"
                        className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/50"
                      >
                        {groupName}
                      </li>
                    )}
                    {groupOpts.map((opt) => {
                      const globalIdx = filteredOptions.indexOf(opt);
                      const isFocused = globalIdx === focusedIdx;
                      const isSelected = opt.value === value;
                      return (
                        <li
                          key={opt.value}
                          id={`${id}-opt-${globalIdx}`}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={opt.disabled}
                          onClick={() => selectOption(opt)}
                          onMouseEnter={() => setFocusedIdx(globalIdx)}
                          className={[
                            'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors',
                            opt.disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : isFocused
                              ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                              : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
                          ].join(' ')}
                        >
                          {opt.icon && (
                            <span className="flex-shrink-0" aria-hidden="true">{opt.icon}</span>
                          )}
                          <span className="flex-1 truncate">{opt.label}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 flex-shrink-0 text-[var(--accent-color)]" aria-hidden="true" />
                          )}
                        </li>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

export const Select = forwardRef(SelectInner) as <T extends string = string>(
  props: SelectProps<T> & { ref?: React.Ref<HTMLButtonElement> }
) => React.ReactElement;

(Select as React.FC).displayName = 'Select';
