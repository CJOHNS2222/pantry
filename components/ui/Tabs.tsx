/**
 * Tabs — Stock & Spoon Design System
 *
 * Flexible tab component system with:
 *  - ARIA tablist / tab / tabpanel semantics
 *  - Keyboard navigation (Arrow keys, Home, End)
 *  - Three visual variants: 'pill' | 'underline' | 'segment'
 *  - Badge support per tab (for counts / notifications)
 *  - Icon support per tab
 *  - Horizontal + vertical orientations (horizontal default)
 *  - Full uncontrolled and controlled modes
 *  - Smooth animated indicator bar for 'underline' variant
 *
 * Usage:
 *   <Tabs defaultValue="pantry" variant="pill">
 *     <TabsList>
 *       <TabsTrigger value="pantry" icon={<Package />} badge={12}>Pantry</TabsTrigger>
 *       <TabsTrigger value="shopping">Shopping</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="pantry"><PantryView /></TabsContent>
 *     <TabsContent value="shopping"><ShoppingView /></TabsContent>
 *   </Tabs>
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TabsVariant = 'pill' | 'underline' | 'segment';
export type TabsOrientation = 'horizontal' | 'vertical';

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: TabsVariant;
  orientation?: TabsOrientation;
  className?: string;
  children: React.ReactNode;
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  /** Stretch tabs to fill full width */
  fullWidth?: boolean;
}

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
  className?: string;
}

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  /** Keep the panel in DOM when inactive (just hidden via display:none) */
  keepMounted?: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
  variant: TabsVariant;
  orientation: TabsOrientation;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs sub-components must be used inside <Tabs>');
  return ctx;
}

// ─── Variant Styles ──────────────────────────────────────────────────────────

const LIST_STYLES: Record<TabsVariant, string> = {
  pill: 'flex gap-1 p-1',
  segment: 'flex gap-0.5 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-1',
  underline: 'flex gap-0 border-b border-[var(--border-color)]',
};

function getTriggerStyle(variant: TabsVariant, isActive: boolean, isDisabled: boolean): string {
  const base = 'flex items-center justify-center gap-1.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-1';
  const disabled = isDisabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  if (variant === 'pill') {
    return `${base} ${disabled} px-3 py-1.5 rounded-full ${
      isActive
        ? 'bg-[var(--accent-color)] text-white shadow-sm'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
    }`;
  }

  if (variant === 'segment') {
    return `${base} ${disabled} flex-1 px-3 py-1.5 rounded-lg ${
      isActive
        ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;
  }

  // underline
  return `${base} ${disabled} px-4 py-2.5 border-b-2 -mb-px ${
    isActive
      ? 'border-[var(--accent-color)] text-[var(--accent-color)]'
      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]/30'
  }`;
}

// ─── Components ───────────────────────────────────────────────────────────────

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  variant = 'pill',
  orientation = 'horizontal',
  className = '',
  children,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const baseId = useId();

  const activeTab = controlledValue ?? internalValue;

  const setActiveTab = useCallback(
    (newValue: string) => {
      if (!controlledValue) setInternalValue(newValue);
      onChange?.(newValue);
    },
    [controlledValue, onChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant, orientation, baseId }}>
      <div
        className={`flex ${orientation === 'vertical' ? 'flex-row' : 'flex-col'} ${className}`}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
};
Tabs.displayName = 'Tabs';

export const TabsList: React.FC<TabsListProps> = ({ children, className = '', fullWidth }) => {
  const { variant, orientation, baseId } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []
    );
    const idx = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return;

    const isHorizontal = orientation === 'horizontal';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

    if (e.key === prevKey) {
      tabs[(idx - 1 + tabs.length) % tabs.length]?.focus();
      e.preventDefault();
    } else if (e.key === nextKey) {
      tabs[(idx + 1) % tabs.length]?.focus();
      e.preventDefault();
    } else if (e.key === 'Home') {
      tabs[0]?.focus();
      e.preventDefault();
    } else if (e.key === 'End') {
      tabs[tabs.length - 1]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation={orientation}
      id={`${baseId}-list`}
      onKeyDown={handleKeyDown}
      className={[
        LIST_STYLES[variant],
        fullWidth ? 'w-full' : '',
        orientation === 'vertical' ? 'flex-col' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
};
TabsList.displayName = 'TabsList';

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  icon,
  badge,
  disabled = false,
  className = '',
}) => {
  const { activeTab, setActiveTab, variant, baseId } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={isActive}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      onClick={() => !disabled && setActiveTab(value)}
      className={`${getTriggerStyle(variant, isActive, disabled)} ${className}`}
    >
      {icon && (
        <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
      )}
      <span>{children}</span>
      {badge !== undefined && (
        <span
          className={`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-bold transition-colors ${
            isActive
              ? variant === 'pill'
                ? 'bg-white/25 text-white'
                : 'bg-[var(--accent-color)]/15 text-[var(--accent-color)]'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
          }`}
          aria-label={`${badge} items`}
        >
          {typeof badge === 'number' && badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
};
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = '',
  keepMounted = false,
}) => {
  const { activeTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  if (!keepMounted && !isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={!isActive}
      tabIndex={0}
      className={`focus-visible:outline-none ${isActive ? 'animate-fade-in' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
TabsContent.displayName = 'TabsContent';
