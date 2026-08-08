import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GroceryCostEstimator, MissingIngredient } from '../../../components/shopping-list/GroceryCostEstimator';
import { groceryPriceService } from '../../../services/groceryPriceService';

// Mock groceryPriceService
vi.mock('../../../services/groceryPriceService', () => ({
  groceryPriceService: {
    getIngredientPrice: vi.fn(),
    submitPriceUpdate: vi.fn(),
    getDefaultPrice: vi.fn().mockReturnValue({ price: 2.99, unit: 'unit' }),
  },
}));

// Mock AppActionsContext so the component doesn't need a provider
vi.mock('../../../contexts/AppActionsContext', () => ({
  useAppActions: () => ({
    addToast: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveSettingsCategory: vi.fn(),
  }),
}));

// Mock AppContext so the component doesn't need a provider
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: null,
  }),
}));

describe('GroceryCostEstimator', () => {
  // Callers (MealPlanner.tsx) already exclude pantry/shopping-list items before
  // passing missingIngredients in — the component itself no longer filters.
  const mockMissingIngredients: MissingIngredient[] = [
    { ingredient: '1 banana', recipeName: 'Oatmeal', recipeId: '1' },
    { ingredient: '2 chicken breasts', recipeName: 'Chicken Salad', recipeId: '2' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows estimate button initially', () => {
    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    expect(screen.getByRole('button', { name: /estimate grocery costs/i })).toBeInTheDocument();
    expect(screen.getByText('Estimate Grocery Costs')).toBeInTheDocument();
  });

  it('opens estimator when button is clicked', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockResolvedValue(null);

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Grocery Cost Estimator')).toBeInTheDocument();
    });

    expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
  });

  it('fetches prices for ingredients when estimator opens', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice)
      .mockResolvedValueOnce({
        averagePrice: 0.79,
        minPrice: 0.69,
        maxPrice: 0.89,
        sampleSize: 10,
        lastUpdated: new Date(),
        unit: 'lb'
      })
      .mockResolvedValueOnce({
        averagePrice: 3.99,
        minPrice: 3.49,
        maxPrice: 4.49,
        sampleSize: 15,
        lastUpdated: new Date(),
        unit: 'lb'
      });

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(groceryPriceService.getIngredientPrice).toHaveBeenCalledWith(expect.stringMatching(/banana/i));
      expect(groceryPriceService.getIngredientPrice).toHaveBeenCalledWith(expect.stringMatching(/chicken breast/i));
    });
  });

  it('displays cost breakdown for missing ingredients', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice)
      .mockResolvedValue({
        averagePrice: 0.50,
        minPrice: 0.45,
        maxPrice: 0.55,
        sampleSize: 5,
        lastUpdated: new Date(),
        unit: 'each'
      });

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
      expect(screen.getByText(/banana/i)).toBeInTheDocument();
      expect(screen.getByText(/chicken breast/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching prices', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(null), 100))
    );

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    // Check for spinning refresh icon (loading state)
    expect(screen.getByText('Refresh Prices')).toBeInTheDocument();
    const refreshButton = screen.getByText('Refresh Prices');
    expect(refreshButton).toBeDisabled();

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('allows user to input custom prices', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockResolvedValue(null);

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
    });

    // Find the custom price input for banana
    const customPriceInputs = screen.getAllByPlaceholderText('Custom price');
    expect(customPriceInputs.length).toBeGreaterThan(0);

    // Enter a custom price
    fireEvent.change(customPriceInputs[0], { target: { value: '1.50' } });

    // The cost should update (this is a basic check that the input works)
    expect(customPriceInputs[0]).toHaveValue(1.5);
  });

  it('calculates total cost using averagePrice * quantity, matching the shopping list formula', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockResolvedValue(null);
    vi.mocked(groceryPriceService.getDefaultPrice).mockImplementation((name: string) => {
      if (/banana/i.test(name)) return { price: 0.79, unit: 'lb' };
      if (/chicken/i.test(name)) return { price: 3.99, unit: 'lb' };
      return { price: 2.99, unit: 'unit' };
    });

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText(/estimated cost for ingredients/i)).toBeInTheDocument();
    });

    // 1 banana @ $0.79 + 2 chicken breasts @ $3.99 = $8.77 (raw-quantity formula, no unit conversion)
    const totalCostContainer = screen.getByText(/estimated cost for ingredients/i).previousElementSibling;
    expect(totalCostContainer).toBeInTheDocument();
    expect(totalCostContainer).toHaveClass('text-2xl', 'font-bold', 'text-green-600');
    expect(totalCostContainer).toHaveTextContent('$8.77');
  });

  it('handles an empty missing-ingredients list', () => {
    render(<GroceryCostEstimator missingIngredients={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    expect(screen.getByText('Grocery Cost Estimator')).toBeInTheDocument();
    expect(screen.getByText('All ingredients are in your pantry or already on your shopping list! 🎉')).toBeInTheDocument();
  });

  it('handles price fetch errors gracefully', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockRejectedValue(new Error('Network error'));

    render(<GroceryCostEstimator missingIngredients={mockMissingIngredients} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
      // Should still show ingredients even if price fetch fails
      expect(screen.getByText(/banana/i)).toBeInTheDocument();
    });
  });
});
