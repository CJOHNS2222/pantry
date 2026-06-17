import { useState, useCallback } from 'react';
import { PantryItem } from '../types';
import { PantryService } from '../services/pantryService';

export function usePantryBulkActions(
  inventory: PantryItem[],
  onUpdateItem: (index: number, updates: Partial<PantryItem>) => Promise<void>,
  deleteItems: (indices: number[]) => Promise<void>,
  addToShoppingList: (items: string[]) => void,
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void
) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkLocationValue, setBulkLocationValue] = useState<string>('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const toggleBulkMode = useCallback(() => {
    setBulkMode(!bulkMode);
    setSelectedItems(new Set());
    setBulkLocationValue('');
  }, [bulkMode]);

  const toggleItemSelection = useCallback((index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  }, [selectedItems]);

  const selectAllItems = useCallback(() => {
    if (selectedItems.size === inventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inventory.map((_, idx) => idx)));
    }
  }, [selectedItems.size, inventory.length]);

  const bulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const count = selectedItems.size;
    const indicesToDelete = Array.from(selectedItems);
    setBulkProgress({ current: 0, total: count });
    await deleteItems(indicesToDelete);
    setBulkProgress(null);
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, deleteItems]);

  const bulkMoveToShoppingList = useCallback(async () => {
    if (selectedItems.size === 0) return;
    const indicesToMove = Array.from(selectedItems);
    const itemsToMove = PantryService.bulkMoveToShoppingList(inventory, indicesToMove);
    addToShoppingList(itemsToMove);
    setBulkProgress({ current: 0, total: indicesToMove.length });
    await deleteItems(indicesToMove);
    setBulkProgress(null);
    setSelectedItems(new Set());
    setBulkMode(false);
    addToast(`Moved ${itemsToMove.length} item${itemsToMove.length > 1 ? 's' : ''} to shopping list`, 'success');
  }, [selectedItems, inventory, addToShoppingList, deleteItems, addToast]);

  const bulkChangeLocation = useCallback(async (newLocation: 'pantry' | 'fridge' | 'freezer' | 'spices' | 'other') => {
    if (selectedItems.size === 0) return;
    const indicesToUpdate = Array.from(selectedItems);
    for (const index of indicesToUpdate) {
      await onUpdateItem(index, { storageLocation: newLocation });
    }
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, onUpdateItem]);

  const bulkSetExpiration = useCallback(async (isoDate: string) => {
    if (selectedItems.size === 0) return;
    const indicesToUpdate = Array.from(selectedItems);
    for (const index of indicesToUpdate) {
      await onUpdateItem(index, { expirationDate: isoDate, expirationType: 'best-by' });
    }
    setSelectedItems(new Set());
    setBulkMode(false);
  }, [selectedItems, onUpdateItem]);

  return {
    bulkMode,
    setBulkMode,
    selectedItems,
    setSelectedItems,
    bulkLocationValue,
    setBulkLocationValue,
    bulkProgress,
    setBulkProgress,
    toggleBulkMode,
    toggleItemSelection,
    selectAllItems,
    bulkDelete,
    bulkMoveToShoppingList,
    bulkChangeLocation,
    bulkSetExpiration
  };
}
