import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MealPlanner } from '../../../components/recipes-meals/MealPlanner';
import { DayPlan, SavedRecipe, PantryItem } from '../../../types';

// Mock react-intl
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: any) => id,
  }),
  FormattedMessage: ({ id }: any) => <span>{id}</span>,
}));

// Mock useSubscription hook to return premium status so PremiumFeature renders its children
const mockUseSubscription = vi.fn(() => ({
  isPremium: true,
  isFamily: false,
  isActive: true,
  loading: false,
  effectiveTier: 'premium'
}));
vi.mock('../../../hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

// Mock recipeService functions
const mockGetCachedPopularRecipes = vi.fn().mockResolvedValue([]);
vi.mock('../../../services/recipeService', () => ({
  getCachedPopularRecipes: () => mockGetCachedPopularRecipes(),
}));

// Mock preferenceUtils functions
const mockRankCachedRecipesByPreferences = vi.fn((recipes) => recipes);
const mockIsRecipeSafeFromAllergies = vi.fn(() => true);
vi.mock('../../../utils/preferenceUtils', () => ({
  rankCachedRecipesByPreferences: (recipes: any, members: any, profile: any) =>
    mockRankCachedRecipesByPreferences(recipes, members, profile),
  isRecipeSafeFromAllergies: (recipe: any, members: any, profile: any) =>
    mockIsRecipeSafeFromAllergies()
}));

// Mock AppContext
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    household: { id: 'household1', members: [] },
    user: { id: 'user1', profile: {} },
  }),
}));

// Mock AppActionsContext
const mockAddToast = vi.fn();
const mockSetActiveTab = vi.fn();
vi.mock('../../../contexts/AppActionsContext', () => ({
  useAppActions: () => ({
    addToast: mockAddToast,
    setActiveTab: mockSetActiveTab,
  }),
}));

// Mock other services
vi.mock('../../../services/analyticsService', () => ({
  default: {
    trackMealPlanRemove: vi.fn(),
    logEvent: vi.fn(),
    trackEvent: vi.fn(),
  },
}));

vi.mock('../../../services/hapticService', () => ({
  default: {
    success: vi.fn(),
  },
}));

vi.mock('../../../services/calendarService', () => ({
  default: {
    exportWeekAsICS: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('MealPlanner - AutoFill Plan', () => {
  const mockUser = {
    id: 'user1',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'avatar.jpg',
    profile: {
      preferences: ['vegetarian']
    }
  };

  const mockMealPlan: DayPlan[] = [
    { date: '2026-06-16', dayName: 'Tue', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-17', dayName: 'Wed', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-18', dayName: 'Thu', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-19', dayName: 'Fri', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-20', dayName: 'Sat', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-21', dayName: 'Sun', breakfast: [], lunch: [], dinner: [] },
    { date: '2026-06-22', dayName: 'Mon', breakfast: [], lunch: [], dinner: [] },
  ];

  const mockSavedRecipes: SavedRecipe[] = [
    {
      id: 'saved1',
      title: 'Saved Recipe One',
      ingredients: ['1 cup rice', '1 can beans'],
      instructions: ['cook rice', 'add beans'],
      cookTime: '20 mins',
      servings: 2,
      userId: 'user1'
    },
    {
      id: 'saved2',
      title: 'Saved Recipe Two',
      ingredients: ['pasta', 'sauce'],
      instructions: ['boil pasta', 'add sauce'],
      cookTime: '15 mins',
      servings: 3,
      userId: 'user1'
    }
  ];

  const mockCachedPopularRecipes: SavedRecipe[] = [
    {
      id: 'cached1',
      title: 'Cached Recipe A',
      ingredients: ['ingredient A'],
      instructions: ['step A'],
      cookTime: '10 mins',
      servings: 4,
      userId: 'system'
    },
    {
      id: 'cached2',
      title: 'Cached Recipe B',
      ingredients: ['ingredient B'],
      instructions: ['step B'],
      cookTime: '10 mins',
      servings: 4,
      userId: 'system'
    },
    {
      id: 'cached3',
      title: 'Cached Recipe C',
      ingredients: ['ingredient C'],
      instructions: ['step C'],
      cookTime: '10 mins',
      servings: 4,
      userId: 'system'
    },
    {
      id: 'cached4',
      title: 'Cached Recipe D',
      ingredients: ['ingredient D'],
      instructions: ['step D'],
      cookTime: '10 mins',
      servings: 4,
      userId: 'system'
    },
    {
      id: 'cached5',
      title: 'Cached Recipe E',
      ingredients: ['ingredient E'],
      instructions: ['step E'],
      cookTime: '10 mins',
      servings: 4,
      userId: 'system'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedPopularRecipes.mockResolvedValue(mockCachedPopularRecipes);
    mockRankCachedRecipesByPreferences.mockImplementation((recipes) => recipes);
  });

  afterEach(() => {
    cleanup();
  });

  it('pulls from saved recipes first, then falls back to ranked cached recipes to fill empty slots without duplicates', async () => {
    let updatedPlan: DayPlan[] = [];
    const updateMealPlan = vi.fn((newPlan) => {
      updatedPlan = newPlan;
    });

    // We pass 2 saved recipes, and want to auto-fill dinner for 5 days.
    // That means we need 5 recipes. The first 2 should be 'Saved Recipe One' and 'Saved Recipe Two'.
    // The next 3 should be chosen from the cached popular recipes.
    // All 5 assigned recipes should be unique.
    render(
      <MealPlanner
        mealPlan={mockMealPlan}
        updateMealPlan={updateMealPlan}
        inventory={[]}
        shoppingList={[]}
        addToShoppingList={vi.fn()}
        user={mockUser}
        setActiveTab={mockSetActiveTab}
        savedRecipes={mockSavedRecipes}
      />
    );

    // Open Auto-Fill Modal
    const autoFillBtn = screen.getByLabelText('Open auto fill modal');
    fireEvent.click(autoFillBtn);

    // Verify modal is open
    expect(screen.getByRole('heading', { name: 'Auto-Fill Plan' })).toBeInTheDocument();

    // Select days to fill: 5 Days button
    const days5Button = screen.getByText('5 Days');
    fireEvent.click(days5Button);

    // Click 'Generate Plan' button
    const generateBtn = screen.getByRole('button', { name: /generate plan/i });
    fireEvent.click(generateBtn);

    // Wait for the async auto-fill to resolve
    await waitFor(() => {
      expect(updateMealPlan).toHaveBeenCalled();
    });

    expect(mockGetCachedPopularRecipes).toHaveBeenCalled();
    expect(mockRankCachedRecipesByPreferences).toHaveBeenCalledWith(
      mockCachedPopularRecipes,
      [],
      mockUser.profile
    );

    // Check the generated plan
    // We filled Dinner for 5 days starting from today (2026-06-16).
    // Let's filter the dinners scheduled for those days
    const dinners = updatedPlan
      .slice(0, 5)
      .map(day => day.dinner?.[0]?.recipe?.title);

    // Ensure we have 5 dinners
    expect(dinners.length).toBe(5);
    expect(dinners.every(title => title !== undefined)).toBe(true);

    // Verify that the first two are the saved recipes
    const savedTitles = mockSavedRecipes.map(r => r.title);
    expect(dinners.slice(0, 2)).toEqual(expect.arrayContaining(savedTitles));

    // Verify the next three are from the cached popular recipes
    const cachedTitles = mockCachedPopularRecipes.map(r => r.title);
    dinners.slice(2, 5).forEach(title => {
      expect(cachedTitles).toContain(title);
    });

    // Verify no duplicates
    const uniqueDinners = new Set(dinners);
    expect(uniqueDinners.size).toBe(5);
  });
});
