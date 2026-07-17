/**
 * components/ui — Stock & Spoon Design System
 * ─────────────────────────────────────────────
 * Central barrel file for the shared UI component library.
 * Import everything from here so refactors stay localized.
 *
 * @example
 *   import { Button, Modal, Modal.Body, useToast } from '../../components/ui';
 */

// ── Primitives ──────────────────────────────────────────────────────────────
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

// ── Feedback & States ────────────────────────────────────────────────────────
export {
  Skeleton,
  RecipeCardSkeleton,
  CompactRecipeCardSkeleton,
  PantryItemSkeleton,
  ShoppingListItemSkeleton,
  MealPlanSkeleton,
} from './SkeletonLoader';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStatePreset, EmptyStateSize } from './EmptyState';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressVariant, ProgressColorMode, ProgressSize } from './ProgressBar';

export { AppBadge } from './AppBadge';

export { SectionStatePanel } from './SectionStatePanel';

// ── Overlays ─────────────────────────────────────────────────────────────────
export { Modal, ModalBody, ModalFooter, useModal } from './Modal';
export type { ModalProps, ModalBodyProps, ModalFooterProps, ModalSize } from './Modal';

export { BottomSheet, BottomSheetBody, BottomSheetFooter, useBottomSheet } from './BottomSheet';
export type {
  BottomSheetProps,
  BottomSheetBodyProps,
  BottomSheetFooterProps,
  BottomSheetSnap,
} from './BottomSheet';

export { ConfirmDialogProvider, useConfirm } from './ConfirmDialog';
export type { ConfirmOptions, ConfirmVariant } from './ConfirmDialog';

// ── Notifications ────────────────────────────────────────────────────────────
export { ToastProvider, useToast } from './Toast';
export type { ToastOptions, ToastVariant, ToastPosition } from './Toast';

export { NotificationBanner } from './NotificationBanner';

// ── Navigation ────────────────────────────────────────────────────────────────
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  TabsVariant,
  TabsOrientation,
} from './Tabs';

// ── Media / Progressive Loading ───────────────────────────────────────────────
export { ProgressiveImage } from './ProgressiveImage';

// ── Error Boundaries ──────────────────────────────────────────────────────────
export { default as ComponentErrorBoundary } from './ComponentErrorBoundary';
export { default as ErrorBoundary } from './ErrorBoundary';

// ── System Overlays ───────────────────────────────────────────────────────────
export { GeminiLoadingOverlay } from './GeminiLoadingOverlay';
export { GlobalUpdatePrompt } from './GlobalUpdatePrompt';
export { SyncIndicator } from './SyncIndicator';
export { OnlineIndicator } from './OnlineIndicator';
