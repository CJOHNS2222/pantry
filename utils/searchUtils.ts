import Fuse from 'fuse.js';
import { PantryItem, StructuredRecipe, SavedRecipe } from '../types';
import { log } from '../services/logService';
import remoteConfig from '../services/remoteConfigService';

// Ingredient matching result interface
export interface IngredientMatch {
  ingredient: string;
  available: boolean;
  pantryItem?: PantryItem;
  requiredQuantity?: number;
  availableQuantity?: number | { amount: number; unit?: string } | undefined;
}

export interface RecipeIngredientMatch {
  recipe: StructuredRecipe | SavedRecipe;
  matchedIngredients: IngredientMatch[];
  totalIngredients: number;
  availableIngredients: number;
  missingIngredients: IngredientMatch[];
  canMake: boolean;
  matchPercentage: number;
}

// Fuzzy search configuration for pantry items
const pantryItemSearchOptions = {
  keys: [
    { name: 'item', weight: 0.7 },
    { name: 'category', weight: 0.2 },
    { name: 'storageLocation', weight: 0.1 }
  ],
  threshold: 0.4, // Lower threshold = more strict matching
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

// Fuzzy search configuration for recipes
const recipeSearchOptions = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'ingredients', weight: 0.3 },
    { name: 'description', weight: 0.1 }
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

// WeakMap instances to cache Fuse search indexes by array reference
const pantryFuseCache = new WeakMap<PantryItem[], Fuse<PantryItem>>();
const recipeFuseCache = new WeakMap<(StructuredRecipe | SavedRecipe)[], Fuse<StructuredRecipe | SavedRecipe>>();

// Search pantry items with fuzzy matching (cached index)
export const searchPantryItems = (items: PantryItem[], query: string): PantryItem[] => {
  if (!query.trim()) return items;

  let fuse = pantryFuseCache.get(items);
  if (!fuse) {
    fuse = new Fuse(items, pantryItemSearchOptions);
    pantryFuseCache.set(items, fuse);
  }
  const results = fuse.search(query);

  return results.map(result => result.item);
};

// Search recipes with fuzzy matching (cached index)
export const searchRecipes = (
  recipes: (StructuredRecipe | SavedRecipe)[],
  query: string
): (StructuredRecipe | SavedRecipe)[] => {
  if (!query.trim()) return recipes;

  let fuse = recipeFuseCache.get(recipes);
  if (!fuse) {
    fuse = new Fuse(recipes, recipeSearchOptions);
    recipeFuseCache.set(recipes, fuse);
  }
  const results = fuse.search(query);

  return results.map(result => result.item);
};

// Get enhanced autocomplete suggestions with context
export interface AutocompleteSuggestion {
  text: string;
  type: 'recent' | 'popular' | 'category' | 'match';
  category?: string;
  count?: number;
}

export const getEnhancedAutocompleteSuggestions = (
  items: PantryItem[],
  query: string,
  maxSuggestions: number = 8,
  _householdId?: string
): AutocompleteSuggestion[] => {
  if (!query || query.trim().length < 2) return [];

  const suggestions: AutocompleteSuggestion[] = [];
  const queryLower = query.trim().toLowerCase();

  // 1. Get direct matches first (highest priority)
  const directMatches = items
    .filter(item => item.item.toLowerCase().includes(queryLower))
    .slice(0, 3)
    .map(item => ({
      text: item.item,
      type: 'match' as const,
      category: item.category
    }));

  suggestions.push(...directMatches);

  // 2. Add recently added items (last 30 days) that match
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentItems = items
    .filter(item => {
      const addedDate = item.dateAdded ? new Date(item.dateAdded) : null;
      return addedDate && addedDate > thirtyDaysAgo && item.item.toLowerCase().includes(queryLower);
    })
    .sort((a, b) => {
      const aDate = new Date(a.dateAdded || 0).getTime();
      const bDate = new Date(b.dateAdded || 0).getTime();
      return bDate - aDate; // Most recent first
    })
    .slice(0, 2)
    .map(item => ({
      text: item.item,
      type: 'recent' as const,
      category: item.category
    }));

  // Only add recent items if they're not already in direct matches
  recentItems.forEach(recent => {
    if (!suggestions.some(s => s.text === recent.text)) {
      suggestions.push(recent);
    }
  });

  // 3. Add popular items in household (most frequently added)
  const itemFrequency = new Map<string, { count: number; category: string; lastAdded: Date }>();
  items.forEach(item => {
    const existing = itemFrequency.get(item.item);
    if (existing) {
      existing.count++;
      const itemDate = item.dateAdded ? new Date(item.dateAdded) : new Date(0);
      if (itemDate > existing.lastAdded) {
        existing.lastAdded = itemDate;
      }
    } else {
      itemFrequency.set(item.item, {
        count: 1,
        category: item.category,
        lastAdded: item.dateAdded ? new Date(item.dateAdded) : new Date(0)
      });
    }
  });

  const popularItems = Array.from(itemFrequency.entries())
    .filter(([itemName]) => itemName.toLowerCase().includes(queryLower))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 2)
    .map(([itemName, data]) => ({
      text: itemName,
      type: 'popular' as const,
      category: data.category,
      count: data.count
    }));

  // Only add popular items if they're not already in suggestions
  popularItems.forEach(popular => {
    if (!suggestions.some(s => s.text === popular.text)) {
      suggestions.push(popular);
    }
  });

  // 4. Add category suggestions if query matches category names
  const categories = [...new Set(items.map(item => item.category))];
  const categoryMatches = categories
    .filter(category => category.toLowerCase().includes(queryLower))
    .slice(0, 2)
    .map(category => ({
      text: category,
      type: 'category' as const,
      category: category
    }));

  suggestions.push(...categoryMatches);

  // Limit total suggestions and return
  return suggestions.slice(0, maxSuggestions);
};

// Get autocomplete suggestions based on existing pantry items (legacy function for backward compatibility)
export const getAutocompleteSuggestions = (
  items: PantryItem[],
  query: string,
  maxSuggestions: number = 5
): string[] => {
  const enhanced = getEnhancedAutocompleteSuggestions(items, query, maxSuggestions);
  return enhanced.map(s => s.text);
};

// Filter pantry items based on saved filter preferences
export interface PantryFilter {
  categories: string[];
  locations: string[];
  expirationStatus: 'all' | 'expiring-soon' | 'expired' | 'fresh';
  quantityStatus: 'all' | 'low-stock' | 'out-of-stock' | 'in-stock';
  sortBy: 'name' | 'expiration' | 'quantity' | 'category' | 'location';
  sortOrder: 'asc' | 'desc';
}

export const defaultPantryFilter: PantryFilter = {
  categories: [],
  locations: [],
  expirationStatus: 'all',
  quantityStatus: 'all',
  sortBy: 'name',
  sortOrder: 'asc'
};

export const filterPantryItems = (items: PantryItem[], filter: PantryFilter): PantryItem[] => {
  let filtered = [...items];

  // Filter by categories
  if (filter.categories.length > 0) {
    filtered = filtered.filter(item => filter.categories.includes(item.category));
  }

  // Filter by locations
  if (filter.locations.length > 0) {
    filtered = filtered.filter(item => filter.locations.includes(item.storageLocation || 'unknown'));
  }

  // Filter by expiration status
  if (filter.expirationStatus !== 'all') {
    const now = new Date();
    const soon = new Date(now.getTime() + remoteConfig.getNumber('expiry_info_days') * 24 * 60 * 60 * 1000);
    const soonFrozen = new Date(now.getTime() + remoteConfig.getNumber('expiry_frozen_alert_days') * 24 * 60 * 60 * 1000);

    filtered = filtered.filter(item => {
      const isFrozen = item.is_frozen || item.storageLocation === 'freezer';
      const effectiveExpiry = isFrozen
        ? (item.freezerExpiry || item.expirationDate)
        : item.expirationDate;
      const threshold = isFrozen ? soonFrozen : soon;

      if (!effectiveExpiry) return filter.expirationStatus === 'fresh';

      const expDate = new Date(effectiveExpiry);
      switch (filter.expirationStatus) {
        case 'expired':
          return expDate < now;
        case 'expiring-soon':
          return expDate >= now && expDate <= threshold;
        case 'fresh':
          return expDate > threshold;
        default:
          return true;
      }
    });
  }

  // Filter by quantity status
  if (filter.quantityStatus !== 'all') {
    filtered = filtered.filter(item => {
      const quantity = getQuantityValue(item);
      switch (filter.quantityStatus) {
        case 'out-of-stock':
          return quantity <= 0;
        case 'low-stock':
          return quantity > 0 && quantity < 1;
        case 'in-stock':
          return quantity >= 1;
        default:
          return true;
      }
    });
  }

  // Sort items
  filtered.sort((a, b) => {
    let aValue: any, bValue: any;

    switch (filter.sortBy) {
      case 'name':
        aValue = a.item.toLowerCase();
        bValue = b.item.toLowerCase();
        break;
      case 'expiration':
        aValue = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
        bValue = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
        break;
      case 'quantity':
        aValue = getQuantityValue(a);
        bValue = getQuantityValue(b);
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      case 'location':
        aValue = (a.storageLocation || '').toLowerCase();
        bValue = (b.storageLocation || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (filter.sortOrder === 'desc') {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    } else {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
  });

  return filtered;
};

// Helper to normalize quantity from PantryItem: handles numeric, structured, or legacy estimate
function getQuantityValue(item: PantryItem): number {
  if (typeof item.quantity === 'number') return item.quantity;
  if (item.quantity && typeof item.quantity === 'object') return (item.quantity as any).amount || 0;
  // Fallback to legacy estimate string
  const est = parseFloat(item.quantity_estimate || '0');
  return isNaN(est) ? 0 : est;
}

// Search history management
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount?: number;
  type: 'pantry' | 'recipe';
}

const SEARCH_HISTORY_KEY = 'smartpantry-search-history';
// Max search history entries — read from RC so it can be tuned without a release.
const getMaxHistoryItems = () => remoteConfig.getNumber('search_history_max_items');

// Save search to history
export const saveSearchToHistory = (query: string, type: 'pantry' | 'recipe', resultCount?: number): void => {
  if (!query.trim()) return;

  try {
    const history: SearchHistoryItem[] = loadSearchHistory();
    const newItem: SearchHistoryItem = {
      query: query.trim(),
      timestamp: Date.now(),
      resultCount,
      type
    };

    // Remove duplicate queries (keep most recent)
    const filtered = history.filter(item => item.query !== query || item.type !== type);

    // Add new item at the beginning
    filtered.unshift(newItem);

    // Keep only recent items
    const recentHistory = filtered.slice(0, getMaxHistoryItems());

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recentHistory));
  } catch (err: any) {
    log.error('Failed to save search history', err, 'SearchUtils');
  }
};

// Load search history
export const loadSearchHistory = (type?: 'pantry' | 'recipe'): SearchHistoryItem[] => {
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      const history: SearchHistoryItem[] = JSON.parse(saved);
      if (type) {
        return history.filter(item => item.type === type);
      }
      return history;
    }
  } catch (err: any) {
    log.error('Failed to load search history', err, 'SearchUtils');
  }
  return [];
};

// Get recent search suggestions
export const getRecentSearchSuggestions = (type: 'pantry' | 'recipe', maxSuggestions: number = 5): string[] => {
  const history = loadSearchHistory(type);
  return history.slice(0, maxSuggestions).map(item => item.query);
};

// Clear search history
export const clearSearchHistory = (type?: 'pantry' | 'recipe'): void => {
  try {
    if (type) {
      const allHistory = loadSearchHistory();
      const filtered = allHistory.filter(item => item.type !== type);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
    } else {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    }
  } catch (err: any) {
    log.error('Failed to clear search history', err, 'SearchUtils');
  }
};

// Pantry filter persistence functions
const PANTRY_FILTER_KEY = 'smartpantry_pantry_filter';

export const savePantryFilter = (filter: PantryFilter): void => {
  try {
    localStorage.setItem(PANTRY_FILTER_KEY, JSON.stringify(filter));
  } catch (err: any) {
    log.error('Failed to save pantry filter', err, 'SearchUtils');
  }
};

export const loadPantryFilter = (): PantryFilter => {
  try {
    const saved = localStorage.getItem(PANTRY_FILTER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all properties exist
      return { ...defaultPantryFilter, ...parsed };
    }
  } catch (err: any) {
    log.error('Failed to load pantry filter', err, 'SearchUtils');
  }
  return defaultPantryFilter;
};

// Match recipe ingredients against pantry inventory
export const matchRecipeIngredients = (
  recipe: StructuredRecipe | SavedRecipe,
  pantryItems: PantryItem[]
): RecipeIngredientMatch => {
  const ingredients = recipe.ingredients || [];
  const matchedIngredients: IngredientMatch[] = [];
  const missingIngredients: IngredientMatch[] = [];

  // Create fuzzy search instance for pantry items
  const pantrySearchOptions = {
    keys: [
      { name: 'item', weight: 0.8 },
      { name: 'category', weight: 0.2 }
    ],
    threshold: 0.3, // More strict matching for ingredient matching
    includeScore: true,
    minMatchCharLength: 2
  };

  const fuse = new Fuse(pantryItems, pantrySearchOptions as any);

  ingredients.forEach(ingredient => {
    // Parse ingredient to get name and quantity
    const parsed = parseIngredientString(ingredient);
    const ingredientName = parsed.name.toLowerCase();

    // Search for matching pantry items
    const searchResults = fuse.search(ingredientName);
    const bestMatch = searchResults.length > 0 ? searchResults[0] : null;

    // Consider it a match if score is good enough and quantities match
    const availableQty = bestMatch ? getQuantityValue(bestMatch.item) : 0;
    const isAvailable = bestMatch &&
                       (bestMatch as any).score < 0.4 && // Good match threshold
                       (!parsed.quantity || availableQty >= (parsed.quantity || 0));

    if (isAvailable && bestMatch) {
      matchedIngredients.push({
        ingredient: parsed.original,
        available: true,
        pantryItem: bestMatch.item,
        requiredQuantity: parsed.quantity,
        availableQuantity: availableQty
      });
    } else {
      missingIngredients.push({
        ingredient: parsed.original,
        available: false,
        requiredQuantity: parsed.quantity,
        availableQuantity: bestMatch ? getQuantityValue(bestMatch.item) : undefined
      });
    }
  });

  const totalIngredients = ingredients.length;
  const availableIngredients = matchedIngredients.length;
  const matchPercentage = totalIngredients > 0 ? (availableIngredients / totalIngredients) * 100 : 0;
  const canMake = availableIngredients === totalIngredients;

  return {
    recipe,
    matchedIngredients,
    totalIngredients,
    availableIngredients,
    missingIngredients,
    canMake,
    matchPercentage
  };
};

// Simple ingredient parser - extracts name and quantity
const parseIngredientString = (ingredient: string): {
  original: string;
  name: string;
  quantity?: number;
  unit?: string;
} => {
  const original = ingredient.trim();

  // Match patterns like "2 cups flour", "1/2 lb chicken", "3 eggs", etc.
  const quantityMatch = ingredient.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*([a-zA-Z]*)\s*(.+)$/);

  if (quantityMatch) {
    const [, qtyStr, unit, name] = quantityMatch;
    const quantity = parseFloat(qtyStr);

    return {
      original,
      name: name.trim(),
      quantity: isNaN(quantity) ? undefined : quantity,
      unit: unit || undefined
    };
  }

  // No quantity found, just return the name
  return {
    original,
    name: ingredient.trim()
  };
};

// Get meal prep suggestions - recipes user can mostly make
export const getMealPrepSuggestions = (
  recipes: (StructuredRecipe | SavedRecipe)[],
  pantryItems: PantryItem[],
  minMatchPercentage: number = 70
): RecipeIngredientMatch[] => {
  return recipes
    .map(recipe => matchRecipeIngredients(recipe, pantryItems))
    .filter(match => match.matchPercentage >= minMatchPercentage)
    .sort((a, b) => {
      // Sort by: can make first, then by match percentage descending
      if (a.canMake && !b.canMake) return -1;
      if (!a.canMake && b.canMake) return 1;
      return b.matchPercentage - a.matchPercentage;
    })
    .slice(0, 10); // Limit to top 10 suggestions
};

/**
 * Generate an intelligent recipe search query based on pantry items and dietary preferences
 */
export function generateIntelligentRecipeQuery(
  inventory: PantryItem[],
  userDietaryRestrictions?: string[]
): string {
  // Check dietary restrictions
  const hasMeatRestrictions = userDietaryRestrictions?.some(
    restriction => restriction === 'vegan' || restriction === 'vegetarian'
  ) || false;

  // Define meat products to look for
  const meatProducts = ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'sausage', 'bacon', 'salmon', 'tuna'];

  let itemsToUse: string[] = [];

  if (!hasMeatRestrictions) {
    // Look for meat products first (prioritize soonest expiring meat)
    const availableMeat = inventory
      .filter(item =>
        !item.is_leftover &&
        meatProducts.some(meat => item.item.toLowerCase().includes(meat.toLowerCase()))
      )
      .sort((a, b) => {
        // Sort by expiration date first, then by meat type priority
        if (a.expirationDate && b.expirationDate) {
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        }
        if (a.expirationDate && !b.expirationDate) return -1;
        if (!a.expirationDate && b.expirationDate) return 1;
        return 0;
      });

    if (availableMeat.length > 0) {
      // Include 1-2 meat items
      const meatItems = availableMeat.slice(0, 2).map(item => item.item);
      itemsToUse.push(...meatItems);

      // Add complementary non-meat items (soonest expiring first)
      const complementaryItems = inventory
        .filter(item =>
          item.expirationDate &&
          !item.is_leftover &&
          !meatProducts.some(meat => item.item.toLowerCase().includes(meat.toLowerCase())) &&
          !itemsToUse.includes(item.item)
        )
        .sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime())
        .slice(0, 3)
        .map(item => item.item);

      itemsToUse.push(...complementaryItems);
    }
  }

  // Fallback: if no meat-focused selection or has dietary restrictions, use soonest expiring items
  if (itemsToUse.length === 0) {
    itemsToUse = inventory
      .filter(item => item.expirationDate && !item.is_leftover)
      .sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime())
      .slice(0, 5)
      .map(item => item.item);
  }

  // Final fallback: if no expiring items, use any pantry items
  if (itemsToUse.length === 0) {
    itemsToUse = inventory
      .filter(item => !item.is_leftover)
      .slice(0, 5)
      .map(item => item.item);
  }

  if (itemsToUse.length === 0) {
    return '';
  }

  // Create a more intelligent search query
  let query = `recipes using ${itemsToUse.join(', ')}`;

  // Add dietary context if restrictions exist
  if (hasMeatRestrictions) {
    const restrictions = userDietaryRestrictions || [];
    if (restrictions.includes('vegan')) {
      query += ' (vegan recipes only)';
    } else if (restrictions.includes('vegetarian')) {
      query += ' (vegetarian recipes only)';
    }
  } else if (itemsToUse.some(item => meatProducts.some(meat => item.toLowerCase().includes(meat.toLowerCase())))) {
    // If we have meat, suggest meat-based recipes
    query += ' (focus on meat-based recipes)';
  }

  return query;
}
