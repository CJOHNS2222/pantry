import Fuse from 'fuse.js';
import { PantryItem, StructuredRecipe, SavedRecipe } from '../types';

// Fuzzy search configuration for pantry items
const pantryItemSearchOptions: Fuse.IFuseOptions<PantryItem> = {
  keys: [
    { name: 'item', weight: 0.7 },
    { name: 'category', weight: 0.2 },
    { name: 'location', weight: 0.1 }
  ],
  threshold: 0.4, // Lower threshold = more strict matching
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

// Fuzzy search configuration for recipes
const recipeSearchOptions: Fuse.IFuseOptions<StructuredRecipe | SavedRecipe> = {
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

// Get autocomplete suggestions based on existing pantry items
export const getAutocompleteSuggestions = (
  items: PantryItem[],
  query: string,
  maxSuggestions: number = 5
): string[] => {
  if (!query.trim() || query.length < 2) return [];

  const fuse = new Fuse(items, {
    keys: ['item'],
    threshold: 0.6,
    includeScore: true,
    minMatchCharLength: 1
  });

  const results = fuse.search(query);
  const suggestions = results
    .slice(0, maxSuggestions)
    .map(result => result.item.item);

  // Also include partial matches for better suggestions
  const partialMatches = items
    .filter(item =>
      item.item.toLowerCase().includes(query.toLowerCase()) &&
      !suggestions.includes(item.item)
    )
    .slice(0, maxSuggestions - suggestions.length)
    .map(item => item.item);

  return [...suggestions, ...partialMatches];
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
    filtered = filtered.filter(item => filter.locations.includes(item.location));
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
      const quantity = parseFloat(item.quantity) || 0;
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
        aValue = parseFloat(a.quantity) || 0;
        bValue = parseFloat(b.quantity) || 0;
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      case 'location':
        aValue = a.location.toLowerCase();
        bValue = b.location.toLowerCase();
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

// Save filter preferences to localStorage
export const savePantryFilter = (filter: PantryFilter): void => {
  try {
    localStorage.setItem('pantry-filter', JSON.stringify(filter));
  } catch (error) {
    console.error('Failed to save pantry filter:', error);
  }
};

// Load filter preferences from localStorage
export const loadPantryFilter = (): PantryFilter => {
  try {
    const saved = localStorage.getItem('pantry-filter');
    if (saved) {
      return { ...defaultPantryFilter, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Failed to load pantry filter:', error);
  }
  return defaultPantryFilter;
};