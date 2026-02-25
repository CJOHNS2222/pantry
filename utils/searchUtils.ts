import Fuse from 'fuse.js';
import { PantryItem, StructuredRecipe, SavedRecipe } from '../types';
import { log } from '../services/logService';

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

// Search pantry items with fuzzy matching
export const searchPantryItems = (items: PantryItem[], query: string): PantryItem[] => {
  if (!query.trim()) return items;

  const fuse = new Fuse(items, pantryItemSearchOptions);
  const results = fuse.search(query);

  return results.map(result => result.item);
};

// Search recipes with fuzzy matching
export const searchRecipes = (
  recipes: (StructuredRecipe | SavedRecipe)[],
  query: string
): (StructuredRecipe | SavedRecipe)[] => {
  if (!query.trim()) return recipes;

  const fuse = new Fuse(recipes, recipeSearchOptions);
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
  householdId?: string
): AutocompleteSuggestion[] => {
  if (!query.trim() || query.length < 1) return [];

  const suggestions: AutocompleteSuggestion[] = [];
  const queryLower = query.toLowerCase();

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
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    filtered = filtered.filter(item => {
      if (!item.expirationDate) return filter.expirationStatus === 'fresh';

      const expDate = new Date(item.expirationDate);
      switch (filter.expirationStatus) {
        case 'expired':
          return expDate < now;
        case 'expiring-soon':
          return expDate >= now && expDate <= soon;
        case 'fresh':
          return expDate > soon;
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
const MAX_HISTORY_ITEMS = 20;

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
    const recentHistory = filtered.slice(0, MAX_HISTORY_ITEMS);

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
