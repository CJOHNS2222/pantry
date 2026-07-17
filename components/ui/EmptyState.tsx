/**
 * EmptyState — Stock & Spoon Design System
 *
 * Contextual zero-data illustrations with:
 *  - Predefined "canned" slots for the app's common empty scenarios
 *    (pantry, shopping list, recipes, search, generic)
 *  - Custom icon, title, description, and action override
 *  - Size variants: compact (inline panels) / default (full sections)
 *  - Optional shimmer illustration placeholder
 *  - Consistent spacing and iconography matching the design language
 *
 * Usage:
 *   <EmptyState preset="pantry" />
 *   <EmptyState preset="search" action={<Button>Add item</Button>} />
 *   <EmptyState
 *     icon={<Package className="w-10 h-10" />}
 *     title="No items here"
 *     description="Start by adding something to this list."
 *     action={<Button variant="secondary">Add item</Button>}
 *   />
 */

import React from 'react';
import {
  Package,
  ShoppingCart,
  BookOpen,
  Search,
  UtensilsCrossed,
  CalendarX,
  Bell,
  Star,
  Inbox,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmptyStatePreset =
  | 'pantry'
  | 'shopping'
  | 'recipes'
  | 'search'
  | 'meals'
  | 'mealplan'
  | 'notifications'
  | 'favorites'
  | 'generic';

export type EmptyStateSize = 'compact' | 'default' | 'large';

export interface EmptyStateProps {
  /** A preset fills icon/title/description automatically */
  preset?: EmptyStatePreset;
  /** Override icon (node rendered at the top) */
  icon?: React.ReactNode;
  /** Override title */
  title?: string;
  /** Override description */
  description?: string;
  /** Optional action element (typically a Button) */
  action?: React.ReactNode;
  /** Size of the empty state block */
  size?: EmptyStateSize;
  /** Remove the background panel for inline use */
  bare?: boolean;
  className?: string;
}

// ─── Preset Config ────────────────────────────────────────────────────────────

interface PresetConfig {
  icon: React.ElementType;
  title: string;
  description: string;
}

const PRESETS: Record<EmptyStatePreset, PresetConfig> = {
  pantry: {
    icon: Package,
    title: 'Your pantry is empty',
    description: 'Scan a receipt or add items manually to start tracking your inventory.',
  },
  shopping: {
    icon: ShoppingCart,
    title: 'Shopping list is clear',
    description: 'You\'re all stocked up! Items will appear here when you need to restock.',
  },
  recipes: {
    icon: BookOpen,
    title: 'No saved recipes yet',
    description: 'Find a recipe you love and save it here to revisit anytime.',
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
  },
  meals: {
    icon: UtensilsCrossed,
    title: 'No meals logged',
    description: 'Log meals to track your nutrition and get personalized recipe suggestions.',
  },
  mealplan: {
    icon: CalendarX,
    title: 'No meal plan yet',
    description: 'Plan your week ahead — drag recipes onto days to build a plan.',
  },
  notifications: {
    icon: Bell,
    title: 'All caught up!',
    description: 'No new notifications. We\'ll let you know when something needs your attention.',
  },
  favorites: {
    icon: Star,
    title: 'No favorites yet',
    description: 'Star recipes and items you love to find them quickly here.',
  },
  generic: {
    icon: Inbox,
    title: 'Nothing here yet',
    description: 'This section is empty. Add some content to get started.',
  },
};

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<
  EmptyStateSize,
  { container: string; iconWrap: string; iconSize: string; title: string; desc: string }
> = {
  compact: {
    container: 'py-8 gap-2',
    iconWrap: 'w-10 h-10 rounded-2xl',
    iconSize: 'w-5 h-5',
    title: 'text-sm font-semibold',
    desc: 'text-xs max-w-xs',
  },
  default: {
    container: 'py-12 gap-3',
    iconWrap: 'w-14 h-14 rounded-2xl',
    iconSize: 'w-7 h-7',
    title: 'text-base font-bold',
    desc: 'text-sm max-w-xs',
  },
  large: {
    container: 'py-16 gap-4',
    iconWrap: 'w-20 h-20 rounded-3xl',
    iconSize: 'w-10 h-10',
    title: 'text-xl font-bold font-serif',
    desc: 'text-base max-w-sm',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  preset = 'generic',
  icon,
  title,
  description,
  action,
  size = 'default',
  bare = false,
  className = '',
}) => {
  const presetConfig = PRESETS[preset];
  const PresetIcon = presetConfig.icon;
  const sizeConfig = SIZE_CONFIG[size];

  const resolvedTitle = title ?? presetConfig.title;
  const resolvedDesc = description ?? presetConfig.description;
  const resolvedIcon = icon ?? (
    <PresetIcon
      className={`${sizeConfig.iconSize} text-[var(--accent-color)]`}
      aria-hidden="true"
    />
  );

  const panelClass = bare
    ? ''
    : 'bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl';

  return (
    <div
      role="status"
      aria-label={resolvedTitle}
      className={[
        'flex flex-col items-center justify-center text-center w-full animate-fade-in',
        sizeConfig.container,
        panelClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon container with subtle glow */}
      <div
        className={[
          'flex items-center justify-center flex-shrink-0',
          'bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20',
          sizeConfig.iconWrap,
        ].join(' ')}
        aria-hidden="true"
      >
        {resolvedIcon}
      </div>

      {/* Text content */}
      <div className="flex flex-col items-center gap-1 px-4">
        <h3 className={`${sizeConfig.title} text-[var(--text-primary)]`}>
          {resolvedTitle}
        </h3>
        <p className={`${sizeConfig.desc} text-[var(--text-secondary)] opacity-70 leading-relaxed`}>
          {resolvedDesc}
        </p>
      </div>

      {/* Optional action */}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
