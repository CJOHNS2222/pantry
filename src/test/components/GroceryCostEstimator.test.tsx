import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GroceryCostEstimator } from '../../../components/GroceryCostEstimator';
import { groceryPriceService } from '../../../services/groceryPriceService';

// Mock groceryPriceService
vi.mock('../../../services/groceryPriceService', () => ({
  groceryPriceService: {
    getIngredientPrice: vi.fn(),
    submitPriceUpdate: vi.fn(),
  },
}));

describe('GroceryCostEstimator', () => {
  const mockMealPlan = [
    {
      date: new Date('2024-01-15'),
      breakfast: [{
        recipe: {
          id: '1',
          title: 'Oatmeal',
          ingredients: ['1 cup oats', '2 cups milk', '1 banana']
        }
      }],
      lunch: [{
        recipe: {
          id: '2',
          title: 'Chicken Salad',
          ingredients: ['2 chicken breasts', '1 head lettuce', '2 tomatoes']
        }
      }],
      dinner: []
    }
  ];

  const mockInventory = [
    { id: '1', item: 'oats', category: 'pantry', quantity_estimate: '5 cups' },
    { id: '2', item: 'milk', category: 'dairy', quantity_estimate: '1 gallon' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows estimate button initially', () => {
    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    expect(screen.getByRole('button', { name: /estimate grocery costs/i })).toBeInTheDocument();
    expect(screen.getByText('Estimate Grocery Costs')).toBeInTheDocument();
  });

  it('opens estimator when button is clicked', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockResolvedValue(null);

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Grocery Cost Estimator')).toBeInTheDocument();
    });

    expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
  });

  it('fetches prices for ingredients when estimator opens', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice)
      .mockResolvedValueOnce({
        price: 0.79,
        unit: 'lb',
        store: 'Generic Store',
        lastUpdated: new Date(),
        source: 'estimated',
        averagePrice: 0.79,
        minPrice: 0.69,
        maxPrice: 0.89,
        sampleSize: 10
      })
      .mockResolvedValueOnce({
        price: 3.99,
        unit: 'lb',
        store: 'Generic Store',
        lastUpdated: new Date(),
        source: 'estimated',
        averagePrice: 3.99,
        minPrice: 3.49,
        maxPrice: 4.49,
        sampleSize: 15
      });

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(groceryPriceService.getIngredientPrice).toHaveBeenCalledWith('banana');
      expect(groceryPriceService.getIngredientPrice).toHaveBeenCalledWith('chicken breasts');
    });
  });

  it('displays cost breakdown for missing ingredients', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice)
      .mockResolvedValue({
        price: 0.50,
        unit: 'each',
        store: 'Generic Store',
        lastUpdated: new Date(),
        source: 'estimated',
        averagePrice: 0.50,
        minPrice: 0.45,
        maxPrice: 0.55,
        sampleSize: 5
      });

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
      expect(screen.getByText('banana')).toBeInTheDocument();
      expect(screen.getByText('chicken breasts')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching prices', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(null), 100))
    );

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

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

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

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

  it('calculates total cost correctly', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockResolvedValue(null);

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Estimated cost for missing ingredients')).toBeInTheDocument();
    });

    // Check that total cost is displayed (should be the large green number with $ and amount)
    const totalCostContainer = screen.getByText('Estimated cost for missing ingredients').previousElementSibling;
    expect(totalCostContainer).toBeInTheDocument();
    expect(totalCostContainer).toHaveClass('text-2xl', 'font-bold', 'text-green-600');
    expect(totalCostContainer).toHaveTextContent('$15.75');
  });

  it('handles empty meal plan', () => {
    render(<GroceryCostEstimator mealPlan={[]} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    expect(screen.getByText('Grocery Cost Estimator')).toBeInTheDocument();
    expect(screen.getByText('All ingredients are in your pantry! 🎉')).toBeInTheDocument();
  });

  it('handles price fetch errors gracefully', async () => {
    vi.mocked(groceryPriceService.getIngredientPrice).mockRejectedValue(new Error('Network error'));

    render(<GroceryCostEstimator mealPlan={mockMealPlan} inventory={mockInventory} />);

    fireEvent.click(screen.getByRole('button', { name: /estimate grocery costs/i }));

    await waitFor(() => {
      expect(screen.getByText('Missing Ingredients:')).toBeInTheDocument();
      // Should still show ingredients even if price fetch fails
      expect(screen.getByText('banana')).toBeInTheDocument();
    });
  });
});