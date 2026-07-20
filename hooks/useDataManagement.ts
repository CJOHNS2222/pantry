import { useEffect } from 'react';
import { log } from '../services/logService';
import { User, PantryItem, StructuredRecipe, Settings } from '../types';
import { deductIngredientAmount, shouldShowExpiryAlert } from '../utils/appUtils';
import { HouseholdPreferenceService } from '../services/householdPreferenceService';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { pruneNotificationsForDeletedItems } from '../services/notificationsService';
import FoodWasteAnalyticsService from '../services/foodWasteAnalyticsService';
import HapticService from '../services/hapticService';
import { setRemoteInventoryUpdate, setRemoteShoppingListUpdate, setRemoteMealPlanUpdate, setRemoteSavedRecipesUpdate } from '../services/syncStateService';
import { getQuantityValue, GUEST_INVENTORY_KEY } from './dataManagement/shared';
import { useHousehold } from './dataManagement/useHousehold';
import { useInventory } from './dataManagement/useInventory';
import { useShoppingList } from './dataManagement/useShoppingList';
import { useMealPlan } from './dataManagement/useMealPlan';
import { useSavedRecipes } from './dataManagement/useSavedRecipes';
import { useRatings } from './dataManagement/useRatings';

/**
 * Thin composer over the per-domain data-management hooks (see hooks/dataManagement/).
 * Calls each domain hook in dependency order (household first, since saved-recipes
 * and meal-plan need its `household` value), implements the handful of genuinely
 * cross-domain behaviors (recipe-completion inventory deduction, the household
 * allergy scan, the risk questionnaire trigger, and the "refresh everything" reload),
 * and assembles the return object. The external shape of this return object is a
 * public contract consumed by App.tsx and must not change as part of this split.
 */
export function useDataManagement(
  user?: User | null,
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number, actionLabel?: string, action?: () => void) => void,
  addToShoppingList?: (items: string[]) => void,
  updateSyncStatus?: (status: Partial<{ isOnline: boolean; isSyncing: boolean; lastSyncTime: Date | null; pendingOperations: number; syncError: string | null }>) => void,
  loggingOptions?: {
    logItemAdded?: (item: string, itemId: string) => void;
    logItemRemoved?: (item: string, itemId: string) => void;
    logShoppingAdded?: (item: string) => void;
    logRecipeSaved?: (recipe: string) => void;
    logMealCompleted?: (meal: string) => void;
    updateActivityStatus?: (activity: string) => void;
  },
  options?: {
    disableInventoryListeners?: boolean;
    onShowAddToPlanDialog?: (recipe: StructuredRecipe) => void;
    settings?: Settings;
  }
) {

  const household = useHousehold(user, addToast);

  const inventory = useInventory(user, addToast, addToShoppingList, loggingOptions, options);

  const shoppingList = useShoppingList(user, household.household, addToast, loggingOptions);

  const mealPlan = useMealPlan(user, household.household, addToast, loggingOptions, options);

  const savedRecipes = useSavedRecipes(user, household.household, addToast);

  const ratings = useRatings(user);

  // Show risk questionnaire once the user adds their first item.
  // Cross-domain: needs `inventory.length` (useInventory) plus
  // `questionnaireShownRef`/`setShowRiskQuestionnaire` (useHousehold).
  useEffect(() => {
    if (!user) return;
    if (household.questionnaireShownRef.current) return;
    // Show when user hasn't set a riskLevel and has at least one inventory item
    if (!user.profile?.riskLevel && inventory.inventory.length > 0) {
      household.setShowRiskQuestionnaire(true);
      household.questionnaireShownRef.current = true;
    }
  }, [user, inventory.inventory.length]);

  // Cross-domain: needs `inventory` (useInventory) plus `lastAllergyCheckRef`
  // and `household.id` (useHousehold).
  useEffect(() => {
    if (!inventory.inventory.length || !user?.id || !household.household?.id) return;

    const now = Date.now();
    if (now - household.lastAllergyCheckRef.current < 5 * 60 * 1000) { // 5 minutes
      return;
    }

    HouseholdPreferenceService.checkHouseholdInventoryForAllergies(household.household.id)
      .then(() => {
        household.lastAllergyCheckRef.current = now;
      }).catch(err => {
        log.error('Failed to check household inventory for allergies:', err, 'DataManagement');
      });

  }, [inventory.inventory, user?.id, household.household?.id]);

  // Cross-domain: recipe completion deducts ingredient quantities from inventory.
  // Reuses useInventory's public `setInventory`/`recordUndo` rather than
  // re-implementing single-item inventory writes here.
  const handleMarkAsMade = async (recipe: StructuredRecipe, deductions?: { itemId: string; ingredient: string }[]) => {
    if (!user?.id) return;
    try {
      if (deductions && deductions.length > 0) {
        let deductedCount = 0;
        const deletedItems: PantryItem[] = [];
        const updatedItems: { item: PantryItem; updates: Partial<PantryItem>; finalItem: PantryItem }[] = [];

        // Start with a snapshot of the current inventory
        const currentInventory = [...inventory.inventory];

        for (const deduction of deductions) {
          const index = currentInventory.findIndex(pi => pi.id === deduction.itemId);
          if (index !== -1) {
            const item = currentInventory[index];
            const remaining = deductIngredientAmount(item.quantity ?? item.quantity_estimate, deduction.ingredient);

            const currentAmount = getQuantityValue(item);
            const remainingAmount = remaining.amount;

            let newVisualLevel = item.visualLevel;
            if (remainingAmount <= 0) {
              newVisualLevel = 'empty';
            } else if (currentAmount > 0) {
              const ratio = remainingAmount / currentAmount;
              if (ratio <= 0.25) {
                newVisualLevel = 'quarter';
              } else if (ratio <= 0.5) {
                newVisualLevel = 'half';
              } else if (ratio <= 0.75) {
                newVisualLevel = 'threeQuarter';
              } else {
                newVisualLevel = 'full';
              }
            } else {
              newVisualLevel = 'full';
            }

            const updates: Partial<PantryItem> = {};
            if (item.quantity && typeof item.quantity === 'object') {
              updates.quantity = {
                ...item.quantity,
                amount: remainingAmount,
                unit: remaining.unit
              };
            } else if (typeof item.quantity === 'number') {
              updates.quantity = remainingAmount;
            } else {
              updates.quantity_estimate = `${remainingAmount} ${remaining.unit}`;
            }

            if (newVisualLevel !== item.visualLevel) {
              updates.visualLevel = newVisualLevel;
            }

            const finalItem = {
              ...item,
              ...updates,
              expiryAlertShown: shouldShowExpiryAlert({ ...item, ...updates })
            };

            // Replace in currentInventory so any subsequent deductions in the same recipe use the new quantity
            currentInventory[index] = finalItem;

            if (remainingAmount <= 0 || newVisualLevel === 'empty') {
              deletedItems.push(item);
            } else {
              updatedItems.push({ item, updates, finalItem });
            }

            deductedCount++;
          }
        }

        if (deductedCount > 0) {
          const deletedIds = new Set(deletedItems.map(i => i.id));
          const finalInventory = currentInventory.filter(item => !deletedIds.has(item.id));

          if (loggingOptions?.updateActivityStatus) {
            loggingOptions.updateActivityStatus('managing inventory');
          }

          if (user?.isGuest) {
            // Record to food waste analytics for guest
            for (const itemToDelete of deletedItems) {
              try {
                const daysExpired = itemToDelete.expirationDate
                  ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const estimatedValue = itemToDelete.estimatedPrice || 2.50;

                await FoodWasteAnalyticsService.recordDisposal({
                  itemId: itemToDelete.id,
                  itemName: itemToDelete.item,
                  category: itemToDelete.category,
                  disposalReason: 'cooked',
                  daysExpired,
                  userId: 'guest',
                  userName: 'Guest',
                  estimatedValue
                });
              } catch (err) {
                log.warn('Failed to record guest waste disposal on recipe deduction', { error: err }, 'DataManagement');
              }
            }

            inventory.setInventory(finalInventory);
            try {
              localStorage.setItem(GUEST_INVENTORY_KEY, JSON.stringify(finalInventory));
            } catch {
              /* storage full */
            }
          } else {
            // Process deletions
            for (const itemToDelete of deletedItems) {
              if (loggingOptions?.logItemRemoved) {
                loggingOptions.logItemRemoved(itemToDelete.item, itemToDelete.id);
              }

              // Record to food waste analytics
              try {
                const daysExpired = itemToDelete.expirationDate
                  ? Math.max(0, Math.ceil((new Date().getTime() - new Date(itemToDelete.expirationDate).getTime()) / (1000 * 60 * 60 * 24)))
                  : 0;
                const estimatedValue = itemToDelete.estimatedPrice || 2.50;

                await FoodWasteAnalyticsService.recordDisposal({
                  itemId: itemToDelete.id,
                  itemName: itemToDelete.item,
                  category: itemToDelete.category,
                  disposalReason: 'cooked',
                  daysExpired,
                  userId: user.id,
                  userName: user.name,
                  estimatedValue
                }, user.householdId);
              } catch (err) {
                log.warn('Failed to record waste disposal on recipe deduction delete', { error: err }, 'DataManagement');
              }

              // Remove from cache
              await InventoryCacheService.removeItemFromCache(itemToDelete.id, user.householdId, user.id);

              // Record delete undo action
              await inventory.recordUndo('delete_item', itemToDelete);
            }

            // Process updates
            for (const updated of updatedItems) {
              await InventoryCacheService.updateItemInCache(updated.item.id, updated.updates, user.householdId, user.id);

              // Record update undo action
              await inventory.recordUndo('update_item', {
                itemId: updated.item.id,
                previousState: updated.item,
                updates: updated.updates
              });
            }

            // Batch side effects for deleted items
            if (deletedItems.length > 0) {
              HapticService.medium();

              // Prune notifications
              pruneNotificationsForDeletedItems(user.id, Array.from(deletedIds)).catch((err: unknown) => log.info('Failed to prune notifications on recipe deduction', { error: err }));

              // Auto-readd staple items for deleted items
              const staplesToReadd = deletedItems.filter(i => i.isStaple);
              if (staplesToReadd.length > 0 && addToShoppingList && (options?.settings?.shopping?.autoReaddStaples !== false)) {
                addToShoppingList(staplesToReadd.map(i => i.item));
                addToast?.(`${staplesToReadd.length} staple item${staplesToReadd.length > 1 ? 's' : ''} auto-added to shopping list`, 'info');
              }
            }

            // Update local state once
            inventory.setInventory(finalInventory);
          }

          if (deletedItems.length > 0) {
            addToast?.(`Deducted ${deductedCount} item${deductedCount > 1 ? 's' : ''} from pantry (${deletedItems.length} finished).`, 'success');
          } else {
            addToast?.(`Deducted ${deductedCount} item${deductedCount > 1 ? 's' : ''} from pantry.`, 'success');
          }
        } else {
          addToast?.('Recipe marked as cooked.', 'success');
        }
      } else {
        addToast?.('Recipe marked as cooked.', 'success');
      }
    } catch (err) {
      log.error('Error in handleMarkAsMade:', err, 'DataManagement');
      addToast?.('Failed to deduct items from pantry.', 'error');
    }
  };

  // Cross-domain: refresh flag + loading-state reset spans every domain hook.
  const refreshAllData = async () => {
    if (!user?.id) return;

    try {
      // Force refresh all caches by clearing and reloading
      inventory.setIsLoadingInventory(true);
      shoppingList.setIsLoadingShoppingList(true);
      mealPlan.setIsLoadingMealPlan(true);
      savedRecipes.setIsLoadingSavedRecipes(true);

      // Clear cache flags to force reload
      setRemoteInventoryUpdate(true);
      setRemoteShoppingListUpdate(true);
      setRemoteMealPlanUpdate(true);
      setRemoteSavedRecipesUpdate(true);

      // The listeners will automatically reload the data
      addToast?.('Data refreshed!', 'success');
    } catch (err) {
      log.error('Failed to refresh data:', err, 'DataManagement');
      addToast?.('Failed to refresh data. Please try again.', 'error');
    }
  };

  return {
    inventory: inventory.inventory,
    setInventory: inventory.setInventory,
    shoppingList: shoppingList.shoppingList,
    setShoppingList: shoppingList.setShoppingList,
    savedRecipes: savedRecipes.savedRecipes,
    setSavedRecipes: savedRecipes.setSavedRecipes,
    ratings: ratings.ratings,
    mealPlan: mealPlan.mealPlan,
    setMealPlan: mealPlan.setMealPlan,
    updateMealPlan: mealPlan.updateMealPlan,
    household: household.household,
    setHousehold: household.setHousehold,
    consumptionSuggestions: inventory.consumptionSuggestions,
    expirationAlerts: inventory.expirationAlerts,
    recipeSuggestions: inventory.recipeSuggestions,
    customCategories: household.customCategories,
    addCustomCategory: household.addCustomCategory,
    updateCustomCategory: household.updateCustomCategory,
    deleteCustomCategory: household.deleteCustomCategory,
    generateRecipeSuggestionsOnDemand: inventory.generateRecipeSuggestionsOnDemand,
    handleAddToPlan: mealPlan.handleAddToPlan,
    addMealToPlan: mealPlan.addMealToPlan,
    updateMealOnPlan: mealPlan.updateMealOnPlan,
    removeMealFromPlan: mealPlan.removeMealFromPlan,
    handleSaveRecipe: savedRecipes.handleSaveRecipe,
    handleDeleteRecipe: savedRecipes.handleDeleteRecipe,
    submitRating: ratings.submitRating,
    getRatingsForRecipe: ratings.getRatingsForRecipe,
    getCommunityRatings: ratings.getCommunityRatings,
    handleMarkAsMade,
    updateItem: inventory.updateItem,
    deleteItem: inventory.deleteItem,
    deleteItems: inventory.deleteItems,
    addItem: inventory.addItem,
    addItems: inventory.addItems,
    recentActions: inventory.recentActions,
    recordUndo: inventory.recordUndo,
    performUndo: inventory.performUndo,
    recipeSaveLimitExceeded: savedRecipes.recipeSaveLimitExceeded,
    mealPlanLimitExceeded: mealPlan.mealPlanLimitExceeded,
    checkRecipeSaveLimit: savedRecipes.checkRecipeSaveLimit,
    checkMealPlanLimit: mealPlan.checkMealPlanLimit,
    // Risk questionnaire state & handler
    showRiskQuestionnaire: household.showRiskQuestionnaire,
    handleRiskQuestionnaireComplete: household.handleRiskQuestionnaireComplete,
    addShoppingListItem: shoppingList.addShoppingListItem,
    addShoppingListItems: shoppingList.addShoppingListItems,
    updateShoppingListItem: shoppingList.updateShoppingListItem,
    updateShoppingListItems: shoppingList.updateShoppingListItems,
    removeShoppingListItem: shoppingList.removeShoppingListItem,
    removeShoppingListItems: shoppingList.removeShoppingListItems,
    refreshAllData,
    setLoadingRatingsComplete: ratings.setLoadingRatingsComplete,
    isLoadingInventory: inventory.isLoadingInventory,
    isLoadingShoppingList: shoppingList.isLoadingShoppingList,
    isLoadingMealPlan: mealPlan.isLoadingMealPlan,
    isLoadingSavedRecipes: savedRecipes.isLoadingSavedRecipes,
    isLoadingRatings: ratings.isLoadingRatings,
    isLoadingHousehold: household.isLoadingHousehold,
  };
}
