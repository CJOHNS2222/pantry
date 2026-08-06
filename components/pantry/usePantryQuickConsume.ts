import React, { useCallback, useEffect, useRef } from 'react';
import { PantryItem } from '../../types';
import { PantryService } from '../../services/pantryService';
import HapticService from '../../services/hapticService';
import { getQuantityAmount } from '../../utils/quantityUtils';
import { DisplayedPantryItem } from './usePantryFilterSort';

/**
 * Hold duration before a press becomes a bulk-select. Was 550ms when long-press
 * opened the detail modal; selection is a more frequent, more casual action, so
 * it wants a shorter hold. Kept above ~300ms to stay clear of an accidental tap
 * and comfortably under Android's own ~500ms text-selection feel.
 */
const LONG_PRESS_MS = 400;

interface UsePantryQuickConsumeOptions {
  inventory: PantryItem[];
  bulkMode: boolean;
  autoReaddStaples: boolean;
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>;
  addToShoppingList: (items: string[]) => void;
  addToast: (
    message: string,
    type: 'success' | 'info' | 'error',
    duration?: number,
    actionLabel?: string,
    action?: () => void | Promise<void>
  ) => void;
  onSelectItem: (index: number) => void;
  /**
   * Enter bulk-select mode with `index` already selected. Long-press is the
   * standard Android idiom for "start selecting", so it takes priority over
   * opening the detail modal once bulk mode is off. Detail remains reachable by
   * tapping the row, and by right-click on desktop (where nobody long-presses).
   */
  onLongPressSelect: (index: number) => void;
  /** Toggles one row's selection. Only called while already in bulk mode. */
  onToggleSelect: (index: number) => void;
}

/**
 * Row-level quick actions for the pantry list: swipe-right to consume one unit,
 * swipe-left to add to the shopping list, long-press / Enter to open detail.
 * Extracted from PantryScanner (FIXES F36).
 */
export function usePantryQuickConsume({
  inventory,
  bulkMode,
  autoReaddStaples,
  onUpdateItem,
  addToShoppingList,
  addToast,
  onSelectItem,
  onLongPressSelect,
  onToggleSelect,
}: UsePantryQuickConsumeOptions) {
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const gestureActionTriggeredRef = useRef(false);
  // Set when the long-press timer actually fires, so the subsequent pointerup
  // is not also interpreted as a swipe or a tap.
  const longPressFiredRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const applyQuickConsume = useCallback(async (item: DisplayedPantryItem) => {
    const original = inventory[item.originalIndex];
    if (!original) return;

    const previous = {
      quantity: original.quantity,
      quantity_estimate: original.quantity_estimate,
      batches: original.batches,
      consumptionHistory: original.consumptionHistory,
    };

    const { updatedItem } = PantryService.consumeFromItem(original, 1, 'FEFO');
    const updates: Partial<PantryItem> = {
      quantity: updatedItem.quantity,
      batches: updatedItem.batches,
      quantity_estimate: String(Math.max(0, Number(original.quantity_estimate || 0) - 1)),
      consumptionHistory: [...(original.consumptionHistory || []), new Date().toISOString()],
    };

    await onUpdateItem(item.originalIndex, updates);
    addToast('Consumed 1 unit', 'success', 5000, 'Undo', async () => {
      await onUpdateItem(item.originalIndex, previous);
    });

    const newQuantity = getQuantityAmount(updatedItem.quantity ?? updatedItem.quantity_estimate);
    if (original.isStaple && newQuantity <= 0 && autoReaddStaples) {
      addToShoppingList([original.item]);
      addToast(`${original.item} auto-added to shopping list (staple)`, 'info');
    }
  }, [inventory, onUpdateItem, addToast, addToShoppingList, autoReaddStaples]);

  const applyQuickAddToShopping = useCallback((item: DisplayedPantryItem) => {
    addToShoppingList([item.item]);
    addToast(`Added ${item.item} to shopping list`, 'info');
  }, [addToShoppingList, addToast]);

  const getRowActionHandlers = useCallback((item: DisplayedPantryItem) => {
    return {
      tabIndex: 0,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        onSelectItem(item.originalIndex);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (bulkMode) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          void applyQuickConsume(item);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          applyQuickAddToShopping(item);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectItem(item.originalIndex);
        }
      },
      onPointerDown: (e: React.PointerEvent) => {
        // Long-press is armed in BOTH modes: off it starts a selection, on it
        // toggles the row. Only the swipe handling below is bulk-mode-gated.
        gestureStartRef.current = { x: e.clientX, y: e.clientY };
        longPressFiredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
          longPressFiredRef.current = true;
          // Haptic confirms the mode switch on touch devices, where there is no
          // hover/cursor feedback to signal that the press registered.
          void HapticService.medium();
          if (bulkMode) {
            onToggleSelect(item.originalIndex);
          } else {
            onLongPressSelect(item.originalIndex);
          }
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!gestureStartRef.current) return;
        const dx = Math.abs(e.clientX - gestureStartRef.current.x);
        const dy = Math.abs(e.clientY - gestureStartRef.current.y);
        if (dx > 10 || dy > 10) {
          clearLongPressTimer();
        }
      },
      onPointerUp: async (e: React.PointerEvent) => {
        clearLongPressTimer();
        // A fired long-press already handled this gesture — don't also treat the
        // release as a swipe (or let the row's onClick open the detail modal).
        if (longPressFiredRef.current) {
          gestureStartRef.current = null;
          gestureActionTriggeredRef.current = true;
          return;
        }
        if (bulkMode || !gestureStartRef.current) return;
        const dx = e.clientX - gestureStartRef.current.x;
        const dy = e.clientY - gestureStartRef.current.y;
        gestureStartRef.current = null;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;
        try {
          if (dx > 0) {
            gestureActionTriggeredRef.current = true;
            await applyQuickConsume(item);
          } else {
            gestureActionTriggeredRef.current = true;
            applyQuickAddToShopping(item);
          }
        } catch (err) {
          console.error('Failed to execute swipe gesture action:', err);
        }
      },
      onPointerLeave: () => {
        clearLongPressTimer();
      },
      // Android fires pointercancel when the system claims the gesture (scroll
      // takeover, back-swipe). Without this the timer would survive and fire a
      // selection after the user had already moved on.
      onPointerCancel: () => {
        clearLongPressTimer();
        gestureStartRef.current = null;
        longPressFiredRef.current = false;
      },
    };
  }, [bulkMode, applyQuickConsume, applyQuickAddToShopping, clearLongPressTimer, onSelectItem, onLongPressSelect, onToggleSelect]);

  /**
   * True when the gesture that just ended was a long-press or swipe, meaning the
   * row's own onClick should not also fire. PantryItemRow declares onClick after
   * spreading these handlers (so it wins), and a click always follows pointerup
   * — without this guard a long-press would select the row AND open its detail
   * modal. Consumes the flag so the next genuine tap is unaffected.
   */
  const consumeGestureSuppression = useCallback(() => {
    const suppressed = gestureActionTriggeredRef.current || longPressFiredRef.current;
    gestureActionTriggeredRef.current = false;
    longPressFiredRef.current = false;
    return suppressed;
  }, []);

  return { applyQuickConsume, applyQuickAddToShopping, getRowActionHandlers, consumeGestureSuppression };
}

export type PantryRowActionHandlers = ReturnType<
  ReturnType<typeof usePantryQuickConsume>['getRowActionHandlers']
>;
