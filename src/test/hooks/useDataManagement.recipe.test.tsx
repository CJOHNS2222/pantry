import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataManagement } from '../../../hooks/useDataManagement';
import { PantryItem, StructuredRecipe } from '../../../types';
import FoodWasteAnalyticsService from '../../../services/foodWasteAnalyticsService';
import { InventoryCacheService } from '../../../services/inventoryCacheService';
import { pruneNotificationsForDeletedItems } from '../../../services/notificationsService';

// Mock Services
vi.mock('../../../services/foodWasteAnalyticsService', () => ({
  default: {
    recordDisposal: vi.fn().mockResolvedValue(undefined),
    getAnalytics: vi.fn().mockResolvedValue(null),
  }
}));

vi.mock('../../../services/inventoryCacheService', () => ({
  InventoryCacheService: {
    removeItemFromCache: vi.fn().mockResolvedValue(undefined),
    updateItemInCache: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('../../../services/notificationsService', () => ({
  pruneNotificationsForDeletedItems: vi.fn().mockResolvedValue(undefined),
}));

describe('useDataManagement - Recipe Deductions (handleMarkAsMade)', () => {
  const mockAddToast = vi.fn();
  const mockAddToShoppingList = vi.fn();

  const mockUser = {
    id: 'user-123',
    name: 'Chef Tester',
    email: 'chef@pantry.com',
    householdId: 'household-123',
    isGuest: false,
    hasSeenTutorial: true,
  };

  const initialInventory: PantryItem[] = [
    {
      id: 'item-1',
      item: 'Chicken breast',
      category: 'Meat',
      quantity: { amount: 3, unit: 'pieces' },
      quantity_estimate: '3',
      storageLocation: 'fridge',
      expirationDate: '2026-06-30', // future
      isStaple: false,
    },
    {
      id: 'item-2',
      item: 'Salt',
      category: 'Spices',
      quantity: { amount: 100, unit: 'g' },
      quantity_estimate: '100',
      storageLocation: 'pantry',
      expirationDate: '2027-01-01',
      isStaple: true,
    },
    {
      id: 'item-3',
      item: 'Tomato',
      category: 'Produce',
      quantity: { amount: 1, unit: 'pieces' },
      quantity_estimate: '1',
      storageLocation: 'fridge',
      expirationDate: '2026-06-25',
      isStaple: true,
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates items correctly when recipe deduction is partial', async () => {
    const { result } = renderHook(() =>
      useDataManagement(mockUser, mockAddToast, mockAddToShoppingList, undefined, undefined, {
        disableInventoryListeners: true,
      })
    );

    // Populate inventory state
    act(() => {
      result.current.setInventory(initialInventory);
    });

    const mockRecipe: StructuredRecipe = {
      title: 'Salted Chicken',
      ingredients: ['2 pieces Chicken breast', '10 g Salt'],
    };

    const deductions = [
      { itemId: 'item-1', ingredient: '2 pieces Chicken breast' },
      { itemId: 'item-2', ingredient: '10 g Salt' },
    ];

    await act(async () => {
      await result.current.handleMarkAsMade(mockRecipe, deductions);
    });

    // Check inventory state updates
    const updatedInventory = result.current.inventory;
    const chicken = updatedInventory.find(i => i.id === 'item-1');
    const salt = updatedInventory.find(i => i.id === 'item-2');
    const tomato = updatedInventory.find(i => i.id === 'item-3');

    // Chicken: 3 - 2 = 1 piece
    expect(chicken).toBeDefined();
    expect(chicken?.quantity?.amount).toBe(1);
    expect(chicken?.visualLevel).not.toBe('empty');

    // Salt: 100 - 10 = 90 g
    expect(salt).toBeDefined();
    expect(salt?.quantity?.amount).toBe(90);

    // Tomato is untouched
    expect(tomato).toBeDefined();
    expect(tomato?.quantity?.amount).toBe(1);

    // Verify cache updates
    expect(InventoryCacheService.updateItemInCache).toHaveBeenCalledWith(
      'item-1',
      expect.any(Object),
      'household-123',
      'user-123'
    );
    expect(InventoryCacheService.updateItemInCache).toHaveBeenCalledWith(
      'item-2',
      expect.any(Object),
      'household-123',
      'user-123'
    );
    expect(InventoryCacheService.removeItemFromCache).not.toHaveBeenCalled();

    // Verify no food waste analytics logging for partial deductions (only logged when deleted/fully depleted)
    expect(FoodWasteAnalyticsService.recordDisposal).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith('Deducted 2 items from pantry.', 'success');
  });

  it('deletes items and logs to food waste analytics when recipe deduction depletes the item completely', async () => {
    const { result } = renderHook(() =>
      useDataManagement(mockUser, mockAddToast, mockAddToShoppingList, undefined, undefined, {
        disableInventoryListeners: true,
      })
    );

    // Populate inventory state
    act(() => {
      result.current.setInventory(initialInventory);
    });

    const mockRecipe: StructuredRecipe = {
      title: 'Tomato Salad',
      ingredients: ['1 pieces Tomato'],
    };

    const deductions = [
      { itemId: 'item-3', ingredient: '1 pieces Tomato' },
    ];

    await act(async () => {
      await result.current.handleMarkAsMade(mockRecipe, deductions);
    });

    // Check inventory state: tomato should be deleted
    const updatedInventory = result.current.inventory;
    const tomato = updatedInventory.find(i => i.id === 'item-3');
    expect(tomato).toBeUndefined();

    // Verify cache removal
    expect(InventoryCacheService.removeItemFromCache).toHaveBeenCalledWith(
      'item-3',
      'household-123',
      'user-123'
    );

    // Verify notification pruning
    expect(pruneNotificationsForDeletedItems).toHaveBeenCalledWith('user-123', ['item-3']);

    // Verify food waste analytics logging
    expect(FoodWasteAnalyticsService.recordDisposal).toHaveBeenCalledWith(
      {
        itemId: 'item-3',
        itemName: 'Tomato',
        category: 'Produce',
        disposalReason: 'cooked',
        daysExpired: expect.any(Number),
        userId: 'user-123',
        userName: 'Chef Tester',
        estimatedValue: 2.50,
      },
      'household-123'
    );

    // Verify auto-readd staple to shopping list (Tomato is a staple)
    expect(mockAddToShoppingList).toHaveBeenCalledWith(['Tomato']);
    expect(mockAddToast).toHaveBeenCalledWith('1 staple item auto-added to shopping list', 'info');
    expect(mockAddToast).toHaveBeenCalledWith('Deducted 1 item from pantry (1 finished).', 'success');
  });

  it('correctly handles a mix of partial deductions and full depletion in a single recipe mark-as-made call', async () => {
    const { result } = renderHook(() =>
      useDataManagement(mockUser, mockAddToast, mockAddToShoppingList, undefined, undefined, {
        disableInventoryListeners: true,
      })
    );

    // Populate inventory state
    act(() => {
      result.current.setInventory(initialInventory);
    });

    const mockRecipe: StructuredRecipe = {
      title: 'Salted Tomato Chicken',
      ingredients: ['2 pieces Chicken breast', '1 pieces Tomato'],
    };

    const deductions = [
      { itemId: 'item-1', ingredient: '2 pieces Chicken breast' }, // partial: 3 -> 1
      { itemId: 'item-3', ingredient: '1 pieces Tomato' },          // depleted: 1 -> 0
    ];

    await act(async () => {
      await result.current.handleMarkAsMade(mockRecipe, deductions);
    });

    const updatedInventory = result.current.inventory;
    expect(updatedInventory.find(i => i.id === 'item-1')?.quantity?.amount).toBe(1);
    expect(updatedInventory.find(i => i.id === 'item-3')).toBeUndefined();

    // Verify cache actions
    expect(InventoryCacheService.updateItemInCache).toHaveBeenCalledWith(
      'item-1',
      expect.any(Object),
      'household-123',
      'user-123'
    );
    expect(InventoryCacheService.removeItemFromCache).toHaveBeenCalledWith(
      'item-3',
      'household-123',
      'user-123'
    );

    // Verify food waste logging
    expect(FoodWasteAnalyticsService.recordDisposal).toHaveBeenCalledTimes(1);
    expect(FoodWasteAnalyticsService.recordDisposal).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-3',
        disposalReason: 'cooked',
      }),
      'household-123'
    );

    expect(mockAddToast).toHaveBeenCalledWith('Deducted 2 items from pantry (1 finished).', 'success');
  });
});
