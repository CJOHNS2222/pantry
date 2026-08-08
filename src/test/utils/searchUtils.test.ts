import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchPantryItems,
  searchRecipes,
  getEnhancedAutocompleteSuggestions,
  getAutocompleteSuggestions,
  filterPantryItems,
  defaultPantryFilter,
  saveSearchToHistory,
  loadSearchHistory,
  clearSearchHistory,
  matchRecipeIngredients,
  getMealPrepSuggestions,
  generateIntelligentRecipeQuery
} from '../../../utils/searchUtils';
import { PantryItem, StructuredRecipe } from '../../../types';

vi.mock('../../../services/remoteConfigService', () => ({
  default: {
    getNumber: vi.fn((key: string) => {
      if (key === 'search_history_max_items') return 10;
      if (key === 'expiry_info_days') return 3;
      if (key === 'expiry_frozen_alert_days') return 7;
      return 5;
    })
  }
}));

describe('searchUtils', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
    vi.mocked(localStorage.getItem).mockImplementation((key) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, val) => { store[key] = String(val); });
    vi.mocked(localStorage.removeItem).mockImplementation((key) => { delete store[key]; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleItems: PantryItem[] = [
    { id: '1', item: 'Organic Milk', category: 'Dairy', storageLocation: 'fridge', expirationDate: '2026-08-10', quantity: 1, dateAdded: '2026-08-01' },
    { id: '2', item: 'Ground Beef', category: 'Meat', storageLocation: 'freezer', is_frozen: true, expirationDate: '2026-09-01', quantity: 2, dateAdded: '2026-08-02' },
    { id: '3', item: 'Fresh Spinach', category: 'Produce', storageLocation: 'fridge', expirationDate: '2026-08-05', quantity: 2, dateAdded: '2026-08-03' },
    { id: '4', item: 'Garlic Powder', category: 'Spices', storageLocation: 'pantry', quantity: 0, dateAdded: '2026-08-04' }
  ];

  describe('searchPantryItems & searchRecipes', () => {
    it('returns all items when query is empty', () => {
      expect(searchPantryItems(sampleItems, '')).toEqual(sampleItems);
    });

    it('filters pantry items by fuzzy match on item name', () => {
      const results = searchPantryItems(sampleItems, 'Milk');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.item).toBe('Organic Milk');
    });

    it('searches recipes by title and ingredients', () => {
      const sampleRecipes: StructuredRecipe[] = [
        { id: 'r1', name: 'Spinach Omelette', ingredients: ['spinach', 'eggs'], instructions: [], servings: 2 },
        { id: 'r2', name: 'Beef Stew', ingredients: ['beef', 'carrots'], instructions: [], servings: 4 }
      ];

      const results = searchRecipes(sampleRecipes, 'Spinach');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Spinach Omelette');
    });
  });

  describe('autocomplete & enhanced suggestions', () => {
    it('returns empty array when query is less than 2 characters', () => {
      expect(getEnhancedAutocompleteSuggestions(sampleItems, 'm')).toEqual([]);
    });

    it('returns enhanced suggestions matching items and categories', () => {
      const suggestions = getEnhancedAutocompleteSuggestions(sampleItems, 'Spin');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.text === 'Fresh Spinach')).toBe(true);
    });

    it('returns legacy string array autocomplete suggestions', () => {
      const legacy = getAutocompleteSuggestions(sampleItems, 'Spin');
      expect(legacy).toContain('Fresh Spinach');
    });
  });

  describe('filterPantryItems', () => {
    it('filters items by category', () => {
      const filtered = filterPantryItems(sampleItems, {
        ...defaultPantryFilter,
        categories: ['Dairy']
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.item).toBe('Organic Milk');
    });

    it('filters items by location', () => {
      const filtered = filterPantryItems(sampleItems, {
        ...defaultPantryFilter,
        locations: ['freezer']
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.item).toBe('Ground Beef');
    });

    it('filters items by quantity status (out-of-stock)', () => {
      const filtered = filterPantryItems(sampleItems, {
        ...defaultPantryFilter,
        quantityStatus: 'out-of-stock'
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.item).toBe('Garlic Powder');
    });

    it('sorts items by name ascending and descending', () => {
      const asc = filterPantryItems(sampleItems, { ...defaultPantryFilter, sortBy: 'name', sortOrder: 'asc' });
      expect(asc[0]?.item).toBe('Fresh Spinach');

      const desc = filterPantryItems(sampleItems, { ...defaultPantryFilter, sortBy: 'name', sortOrder: 'desc' });
      expect(desc[0]?.item).toBe('Organic Milk');
    });
  });

  describe('search history management', () => {
    it('saves and loads search history', () => {
      saveSearchToHistory('chicken', 'pantry', 3);
      const history = loadSearchHistory('pantry');
      expect(history.length).toBe(1);
      expect(history[0]?.query).toBe('chicken');
    });

    it('clears search history by type', () => {
      saveSearchToHistory('pasta', 'recipe', 5);
      clearSearchHistory('recipe');
      expect(loadSearchHistory('recipe')).toEqual([]);
    });
  });

  describe('matchRecipeIngredients & getMealPrepSuggestions', () => {
    const sampleRecipe: StructuredRecipe = {
      id: 'r1',
      name: 'Spinach Salad',
      ingredients: ['1 cup spinach', '2 tbsp olive oil'],
      instructions: [],
      servings: 1
    };

    it('matches recipe ingredients against pantry items', () => {
      const matchResult = matchRecipeIngredients(sampleRecipe, sampleItems);
      expect(matchResult.totalIngredients).toBe(2);
      expect(matchResult.matchedIngredients.some(m => m.ingredient.includes('spinach'))).toBe(true);
    });

    it('returns meal prep suggestions above minimum match percentage', () => {
      const suggestions = getMealPrepSuggestions([sampleRecipe], sampleItems, 30);
      expect(suggestions).toBeDefined();
    });
  });

  describe('generateIntelligentRecipeQuery', () => {
    it('generates query prioritizing meat and expiring items', () => {
      const query = generateIntelligentRecipeQuery(sampleItems);
      expect(query).toContain('recipes using');
      expect(query.toLowerCase()).toContain('beef');
    });

    it('adds vegan/vegetarian constraint when user has restrictions', () => {
      const query = generateIntelligentRecipeQuery(sampleItems, ['vegan']);
      expect(query).toContain('vegan recipes only');
    });
  });
});
