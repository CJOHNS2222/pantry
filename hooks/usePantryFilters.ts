import { useState, useMemo, useEffect } from 'react';
import { PantryItem, PantryFilter } from '../types';
import { loadPantryFilter, savePantryFilter, defaultPantryFilter, filterPantryItems, searchPantryItems, getMealPrepSuggestions, RecipeIngredientMatch } from '../utils/searchUtils';
import { getQuantityAmount } from '../utils/quantityUtils';

export type DisplayedPantryItem = PantryItem & {
  originalIndex: number;
  originalIndices?: number[];
  combinedItems?: PantryItem[];
  totalQuantity?: number;
};

export function usePantryFilters(inventory: PantryItem[], recipes: any[], initialSearchQuery?: string) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [pantryFilter, setPantryFilter] = useState<PantryFilter>(loadPantryFilter());
  const [viewMode, setViewMode] = useState<'category' | 'storage'>('storage');
  const [sortBy, setSortBy] = useState<'name' | 'lastAdded' | 'expiration' | 'category' | 'location'>('location');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [storageSectionOrder, setStorageSectionOrder] = useState<string[]>(['leftovers', 'pantry', 'fridge', 'freezer', 'spices', 'other']);
  const [mealPrepSuggestions, setMealPrepSuggestions] = useState<RecipeIngredientMatch[]>([]);

  // Update debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Update meal prep suggestions when inventory or recipes change
  useEffect(() => {
    if (recipes && recipes.length > 0 && inventory && inventory.length > 0) {
      try {
        const suggestions = getMealPrepSuggestions(recipes, inventory, 60);
        setMealPrepSuggestions(suggestions);
      } catch (_e) {
        setMealPrepSuggestions([]);
      }
    } else {
      setMealPrepSuggestions([]);
    }
  }, [inventory, recipes]);

  const handleUpdateFilter = (newFilter: PantryFilter) => {
    setPantryFilter(newFilter);
    savePantryFilter(newFilter);
  };

  const handleClearFilters = () => {
    setPantryFilter(defaultPantryFilter);
    savePantryFilter(defaultPantryFilter);
  };

  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return newExpanded;
    });

    // Bring clicked category to the top
    setCategoryOrder(prev => {
      const filtered = prev.filter(c => c !== category);
      return [category, ...filtered];
    });
  };

  const toggleStorageLocation = (location: string) => {
    setStorageSectionOrder(prev => {
      const filtered = prev.filter(l => l !== location);
      return [location, ...filtered];
    });
  };

  // Process and sort inventory
  const processedInventory = useMemo(() => {
    const withIndices = inventory.map((item, index) => ({ ...item, originalIndex: index })) as DisplayedPantryItem[];
    const filtered = filterPantryItems(withIndices, pantryFilter) as DisplayedPantryItem[];
    if (!debouncedSearchQuery.trim()) {
      return filtered;
    }
    return searchPantryItems(filtered, debouncedSearchQuery) as DisplayedPantryItem[];
  }, [inventory, pantryFilter, debouncedSearchQuery]);

  const sortedInventory = useMemo(() => {
    return [...processedInventory].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.item.localeCompare(b.item);
        case 'lastAdded': {
          const aDate = a.lastRestocked || a.dateAdded || '';
          const bDate = b.lastRestocked || b.dateAdded || '';
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }
        case 'expiration': {
          const aExp = a.expirationDate || '9999-12-31';
          const bExp = b.expirationDate || '9999-12-31';
          return new Date(aExp).getTime() - new Date(bExp).getTime();
        }
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        case 'location': {
          const locationOrder: Record<string, number> = { pantry: 1, fridge: 2, freezer: 3, spices: 4, other: 5 };
          const aLoc = a.storageLocation || 'pantry';
          const bLoc = b.storageLocation || 'pantry';
          return (locationOrder[aLoc] || 5) - (locationOrder[bLoc] || 5);
        }
        default:
          return 0;
      }
    });
  }, [processedInventory, sortBy]);

  // Group inventory by category
  const groupedItems = useMemo(() => {
    return sortedInventory.reduce((acc, item) => {
      const category = item.is_leftover ? 'Leftovers' : (item.category || 'Uncategorized');
      if (!acc[category]) {
        acc[category] = {};
      }

      const itemKey = item.id || item.item;
      if (!acc[category][itemKey]) {
        acc[category][itemKey] = {
          ...item,
          combinedItems: [item],
          totalQuantity: getQuantityAmount(item.quantity ?? item.quantity_estimate),
          originalIndices: [item.originalIndex],
          originalIndex: item.originalIndex
        };
      } else {
        const currentAmount = getQuantityAmount(acc[category][itemKey].quantity ?? acc[category][itemKey].quantity_estimate);
        const newAmount = getQuantityAmount(item.quantity ?? item.quantity_estimate);
        const combinedAmount = currentAmount + newAmount;

        acc[category][itemKey].combinedItems!.push(item);
        acc[category][itemKey].totalQuantity = combinedAmount;
        acc[category][itemKey].originalIndices!.push(item.originalIndex);

        if (typeof acc[category][itemKey].quantity === 'object' && acc[category][itemKey].quantity !== null) {
          acc[category][itemKey].quantity = {
            ...(acc[category][itemKey].quantity as any),
            amount: combinedAmount
          };
        } else if (typeof item.quantity === 'object' && item.quantity !== null) {
          acc[category][itemKey].quantity = {
            ...item.quantity,
            amount: combinedAmount
          };
        } else {
          acc[category][itemKey].quantity = combinedAmount as any;
        }
      }
      return acc;
    }, {} as Record<string, Record<string, DisplayedPantryItem>>);
  }, [sortedInventory]);

  const categoryItemsArrays = useMemo(() => {
    return Object.keys(groupedItems).reduce((acc, category) => {
      acc[category] = Object.values(groupedItems[category]);
      return acc;
    }, {} as Record<string, DisplayedPantryItem[]>);
  }, [groupedItems]);

  const sortedCategories = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [groupedItems, categoryOrder]);

  // Group inventory by storage location
  const groupedByStorage = useMemo(() => {
    return sortedInventory.reduce((acc, item) => {
      const location = item.is_leftover ? 'leftovers' : (item.storageLocation || 'pantry');
      if (!acc[location]) {
        acc[location] = {};
      }

      const itemKey = item.id || item.item;
      if (!acc[location][itemKey]) {
        acc[location][itemKey] = {
          ...item,
          combinedItems: [item],
          totalQuantity: getQuantityAmount(item.quantity ?? item.quantity_estimate),
          originalIndices: [item.originalIndex],
          originalIndex: item.originalIndex
        };
      } else {
        const currentAmount = getQuantityAmount(acc[location][itemKey].quantity ?? acc[location][itemKey].quantity_estimate);
        const newAmount = getQuantityAmount(item.quantity ?? item.quantity_estimate);
        const combinedAmount = currentAmount + newAmount;

        acc[location][itemKey].combinedItems!.push(item);
        acc[location][itemKey].totalQuantity = combinedAmount;
        acc[location][itemKey].originalIndices!.push(item.originalIndex);

        if (typeof acc[location][itemKey].quantity === 'object' && acc[location][itemKey].quantity !== null) {
          acc[location][itemKey].quantity = {
            ...(acc[location][itemKey].quantity as any),
            amount: combinedAmount
          };
        } else if (typeof item.quantity === 'object' && item.quantity !== null) {
          acc[location][itemKey].quantity = {
            ...item.quantity,
            amount: combinedAmount
          };
        } else {
          acc[location][itemKey].quantity = combinedAmount as any;
        }
      }
      return acc;
    }, {} as Record<string, Record<string, DisplayedPantryItem>>);
  }, [sortedInventory]);

  const storageItemsArrays = useMemo(() => {
    return Object.keys(groupedByStorage).reduce((acc, location) => {
      acc[location] = Object.values(groupedByStorage[location]);
      return acc;
    }, {} as Record<string, DisplayedPantryItem[]>);
  }, [groupedByStorage]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    showFilters,
    setShowFilters,
    pantryFilter,
    handleUpdateFilter,
    handleClearFilters,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    expandedCategories,
    toggleCategory,
    collapseAllCategories,
    storageSectionOrder,
    toggleStorageLocation,
    processedInventory,
    sortedInventory,
    groupedItems,
    categoryItemsArrays,
    sortedCategories,
    groupedByStorage,
    storageItemsArrays,
    mealPrepSuggestions
  };
}
