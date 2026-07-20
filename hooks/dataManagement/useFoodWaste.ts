import { useMemo } from 'react';
import { PantryItem } from '../../types';
import { generateConsumptionSuggestions, generateRecipeSuggestions } from '../../utils/appUtils';

/**
 * Memoized consumption + recipe suggestions, recomputed only when inventory changes.
 */
export function useFoodWaste(inventory: PantryItem[]) {
  return useMemo(() => ({
    consumptionSuggestions: generateConsumptionSuggestions(inventory),
    recipeSuggestions: generateRecipeSuggestions(inventory),
  }), [inventory]);
}
