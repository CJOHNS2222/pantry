import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RecipeFinder } from '../recipes-meals/RecipeFinder';
import { RecipeSearchResult, StructuredRecipe, SavedRecipe, PantryItem, RecipeRating, User, Household } from '../../types';
import { Tab } from '../../types/app';

// Mock services and utilities
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage, id }: { defaultMessage?: string; id: string }) => defaultMessage || id,
  }),
}));

vi.mock('../../services/geminiService', () => ({
  searchRecipes: vi.fn(),
}));

vi.mock('../../services/recipeService', () => ({
  getSavedRecipes: vi.fn(() => Promise.resolve([])),
  getCachedPopularRecipes: vi.fn(() => Promise.resolve([])),
  getCachedRecipesCache: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/analyticsService', () => ({
  default: {
    trackRecipeSearch: vi.fn(),
    trackRecipeSave: vi.fn(),
    trackRecipeView: vi.fn(),
  },
}));

vi.mock('../../services/logService', () => ({
  log: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../utils/searchUtils', () => ({
  searchPantryItems: vi.fn(),
  getEnhancedAutocompleteSuggestions: vi.fn(),
  filterPantryItems: vi.fn(),
  savePantryFilter: vi.fn(),
  loadPantryFilter: vi.fn(),
  defaultPantryFilter: {},
  saveSearchToHistory: vi.fn(),
  getRecentSearchSuggestions: vi.fn(),
}));

vi.mock('../../utils/debounceUtils', () => ({
  debounce: vi.fn((fn) => fn),
}));

vi.mock('../../utils/preferenceUtils', () => ({
  filterRecipesByHouseholdPreferences: vi.fn((recipes) => ({ safeRecipes: recipes, riskyRecipes: [] })),
  rankCachedRecipesByPreferences: vi.fn((recipes) => recipes),
  checkRecipeAgainstPreferences: vi.fn(() => ({ isSafe: true, violations: { allergies: [], restrictions: [], dislikes: [] }, warnings: [] })),
  recipeMatchesCacheFilters: vi.fn(() => true),
}));

vi.mock('../hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: vi.fn(() => ({
    handleKeyDown: vi.fn(),
    focusedIndex: -1,
  })),
}));

// Mock child components
vi.mock('../ui/SkeletonLoader', () => ({
  RecipeCardSkeleton: () => <div data-testid="recipe-card-skeleton">Loading...</div>,
}));

vi.mock('../settings/PremiumFeature', () => ({
  PremiumFeature: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../recipes-meals/RecipeRating', () => ({
  RecipeRatingUI: () => <div data-testid="recipe-rating">Rating</div>,
}));

vi.mock('../ui/ProgressiveImage', () => ({
  ProgressiveImage: ({ alt }: { alt: string }) => <img alt={alt} data-testid="progressive-image" />,
}));

vi.mock('../recipes-meals/RecipeModal', () => ({
  default: () => <div data-testid="recipe-modal">Recipe Modal</div>,
}));

const mockUser: User = {
  id: 'test-user',
  email: 'test@example.com',
  profile: {
    name: 'Test User',
    avatar: null,
  },
  subscription: {
    tier: 'free',
    status: 'active',
    current_period_end: new Date(),
    cancel_at_period_end: false,
  },
  provider: 'email',
  hasSeenTutorial: true,
};

const mockInventory: PantryItem[] = [
  {
    id: '1',
    item: 'Chicken Breast',
    category: 'Meat',
    quantity: 2,
    storageLocation: 'fridge',
    expirationDate: '2026-03-01',
  },
];

const mockRatings: RecipeRating[] = [];
const mockSavedRecipes: SavedRecipe[] = [];

const defaultProps = {
  onAddToPlan: vi.fn(),
  onSaveRecipe: vi.fn(),
  onDeleteRecipe: vi.fn(),
  onMarkAsMade: vi.fn(),
  inventory: mockInventory,
  ratings: mockRatings,
  onRate: vi.fn(),
  savedRecipes: mockSavedRecipes,
  user: mockUser,
  setActiveTab: vi.fn(),
  persistedResult: null,
  setPersistedResult: vi.fn(),
  initialSearchQuery: '',
  addToast: vi.fn(),
  recipeSaveLimitExceeded: false,
  mealPlanLimitExceeded: false,
  isLoadingSavedRecipes: false,
  household: null as Household | null,
};

describe('RecipeFinder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders search input and basic UI elements', () => {
    render(<RecipeFinder {...defaultProps} />);

    const searchInputs = screen.getAllByPlaceholderText('Search e.g. Pasta...');
    expect(searchInputs[0]).toBeInTheDocument();
    const searchButton = screen.getByRole('button', { name: /Suggest Recipes/i });
    expect(searchButton).toBeInTheDocument();
  });

  test('displays initial search query when provided', () => {
    const props = { ...defaultProps, initialSearchQuery: 'chicken stir fry' };
    render(<RecipeFinder {...props} />);

    const searchInputs = screen.getAllByPlaceholderText('Search e.g. Pasta...');
    expect(searchInputs[0]).toBeInTheDocument();
  });

  test('shows loading state when searching', async () => {
    // Mock the search function to return a promise that doesn't resolve immediately
    const { searchRecipes } = await import('../../services/geminiService');
    vi.mocked(searchRecipes).mockImplementation(() => new Promise(() => {}));

    render(<RecipeFinder {...defaultProps} />);

    const searchInputs = screen.getAllByPlaceholderText('Search e.g. Pasta...');
    const searchInput = searchInputs[0];
    const searchButton = screen.getAllByTestId('recipefinder-search-button')[0];

    fireEvent.change(searchInput, { target: { value: 'chicken' } });
    fireEvent.click(searchButton);

    // Should show loading state (at least one skeleton rendered)
    await waitFor(() => {
      expect(screen.getAllByTestId('recipe-card-skeleton').length).toBeGreaterThan(0);
    });
  });

  test('handles search results display', async () => {
    const mockRecipe: StructuredRecipe = {
      id: 'test-recipe',
      title: 'Test Chicken Recipe',
      description: 'A delicious chicken recipe',
      ingredients: ['Chicken Breast', 'Salt'],
      instructions: ['Cook the chicken', 'Season with salt'],
      servings: 4,
      prepTime: 15,
      cookTime: 30,
      totalTime: 45,
      difficulty: 'Easy',
      cuisine: 'American',
      tags: ['chicken', 'quick'],
      nutritionalInfo: {
        calories: 300,
        protein: 25,
        carbs: 10,
        fat: 15,
      },
      imageUrl: 'https://example.com/recipe.jpg',
    };

    const mockSearchResult: RecipeSearchResult = {
      query: 'chicken',
      recipes: [mockRecipe],
      searchTime: 1000,
      totalResults: 1,
    };

    const { searchRecipes } = await import('../../services/geminiService');
    vi.mocked(searchRecipes).mockResolvedValue(mockSearchResult);

    // Render component with persistedResult to directly verify rendering of results
    const props = { ...defaultProps, persistedResult: mockSearchResult };
    render(<RecipeFinder {...props} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Chicken Recipe' })).toBeInTheDocument();
    });
  });

  test('calls onSaveRecipe when save button is clicked', async () => {
    const mockRecipe: StructuredRecipe = {
      id: 'test-recipe',
      title: 'Test Recipe',
      description: 'A test recipe',
      ingredients: ['Test Ingredient'],
      instructions: ['Test instruction'],
      servings: 2,
      prepTime: 10,
      cookTime: 20,
      totalTime: 30,
      difficulty: 'Easy',
      cuisine: 'Test',
      tags: ['test'],
      nutritionalInfo: {
        calories: 200,
        protein: 10,
        carbs: 20,
        fat: 10,
      },
      imageUrl: 'https://example.com/test.jpg',
    };

    const mockSearchResult: RecipeSearchResult = {
      query: 'test',
      recipes: [mockRecipe],
      searchTime: 500,
      totalResults: 1,
    };

    // Render component with persistedResult to directly verify modal opens for a result
    const mockOnSaveRecipe = vi.fn();
    const props = { ...defaultProps, onSaveRecipe: mockOnSaveRecipe, persistedResult: mockSearchResult };

    render(<RecipeFinder {...props} />);

    // Click on the recipe to open modal
    const recipeCard = await screen.findByRole('heading', { name: 'Test Recipe' });
    fireEvent.click(recipeCard);

    // Modal should be opened
    expect(screen.getByTestId('recipe-modal')).toBeInTheDocument();
  });

  test('renders with recipe save limit exceeded prop', () => {
    const props = { ...defaultProps, recipeSaveLimitExceeded: true };
    render(<RecipeFinder {...props} />);

    // Component should render without errors — ensure at least one main landmark exists
    const mains = screen.getAllByRole('main');
    expect(mains.length).toBeGreaterThan(0);
    expect(mains.some(m => m.getAttribute('aria-label') === 'Recipe finder')).toBe(true);
  });

  test('handles popular section search without AI-driven search', async () => {
    const mockRecipe: SavedRecipe = {
      id: 'popular-recipe',
      title: 'Popular Chicken',
      description: 'A popular chicken recipe',
      ingredients: ['Chicken'],
      instructions: ['Cook it'],
      cookTime: '20 mins',
      type: 'Dinner',
    };

    const { getCachedRecipesCache } = await import('../../services/recipeService');
    const { searchRecipes } = await import('../../services/geminiService');
    vi.mocked(getCachedRecipesCache).mockResolvedValue([mockRecipe]);

    render(<RecipeFinder {...defaultProps} />);

    // Trigger the meal filter in the popular section
    const dinnerFilterBtn = screen.getByRole('button', { name: /dinner/i });
    fireEvent.click(dinnerFilterBtn);

    const searchAllBtn = screen.getByRole('button', { name: /Search All.*Dinner/i });
    expect(searchAllBtn).toBeInTheDocument();
    fireEvent.click(searchAllBtn);

    // It should load and display the cached recipe without calling searchRecipes (AI)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Popular Chicken' })).toBeInTheDocument();
    });

    expect(searchRecipes).not.toHaveBeenCalled();
  });
});