import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import PriceTrends from '../../../components/pantry/PriceTrends';
import { groceryPriceService } from '../../../services/groceryPriceService';

// Mock groceryPriceService
vi.mock('../../../services/groceryPriceService', () => ({
  groceryPriceService: {
    getPriceTrendAnalysis: vi.fn(),
  },
}));

describe('PriceTrends', () => {
  const mockOnClose = vi.fn();
  const mockIngredient = 'chicken breast';

  const mockTrendData = {
    currentPrice: 5.99,
    priceChange: 0.50,
    priceChangePercent: 9.1,
    lastUpdated: new Date(2024, 0, 15), // January 15, 2024
    priceHistory: [
      { date: new Date(2024, 0, 1), price: 5.49 }, // January 1, 2024
      { date: new Date(2024, 0, 8), price: 5.75 }, // January 8, 2024
      { date: new Date(2024, 0, 15), price: 5.99 }, // January 15, 2024
    ],
  };

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('shows loading state initially', () => {
    // Mock the service to never resolve (stays loading)
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    expect(screen.getByText('Loading price trends...')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays price trend data when loaded successfully', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(mockTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    expect(screen.getByText('Current Price')).toBeInTheDocument();
    // Use more specific selector for current price
    expect(screen.getByText('$5.99', { selector: '.text-2xl.font-bold' })).toBeInTheDocument();
    expect(screen.getByText('Price Change')).toBeInTheDocument();
    expect(screen.getByText('+$0.50')).toBeInTheDocument();
    expect(screen.getByText('+9.1% from last month')).toBeInTheDocument();
    expect(screen.getByText('Recent Price History')).toBeInTheDocument();
    expect(screen.getByText('Trend Analysis')).toBeInTheDocument();
    expect(screen.getByText('Prices are trending upward. Consider buying now if you need chicken breast soon.')).toBeInTheDocument();
  });

  it('displays downward trend message for negative price change', async () => {
    const downwardTrendData = {
      ...mockTrendData,
      priceChange: -0.30,
      priceChangePercent: -4.8,
    };
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(downwardTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    expect(screen.getByText('$-0.30')).toBeInTheDocument();
    expect(screen.getByText('-4.8% from last month')).toBeInTheDocument();
    expect(screen.getByText('Prices are trending downward. This might be a good time to stock up on chicken breast.')).toBeInTheDocument();
  });

  it('displays stable trend message for small price changes', async () => {
    const stableTrendData = {
      ...mockTrendData,
      priceChange: 0.05,
      priceChangePercent: 0.8,
    };
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(stableTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    expect(screen.getByText('+$0.05')).toBeInTheDocument();
    expect(screen.getByText('+0.8% from last month')).toBeInTheDocument();
    expect(screen.getByText('Prices are relatively stable. No significant trend detected.')).toBeInTheDocument();
  });

  it('shows error state when service fails', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockRejectedValue(new Error('Service error'));

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load price trends')).toBeInTheDocument();
    });

    expect(screen.getByText('Price Trends')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('shows no data message when trends is null', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(null);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No trend data available')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(mockTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]!); // Click the main close button

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when error close button is clicked', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockRejectedValue(new Error('Service error'));

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load price trends')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close'));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays price history when available', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(mockTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Price History')).toBeInTheDocument();
    });

    // Should show the last 10 entries (we have 3)
    expect(screen.getByText('1/1/2024')).toBeInTheDocument();
    expect(screen.getByText('$5.49')).toBeInTheDocument();
    expect(screen.getByText('1/8/2024')).toBeInTheDocument();
    expect(screen.getByText('$5.75')).toBeInTheDocument();
    expect(screen.getByText('1/15/2024')).toBeInTheDocument();
    // Check that $5.99 appears in the history (there should be 2 instances total)
    const priceElements = screen.getAllByText('$5.99');
    expect(priceElements).toHaveLength(2); // One in current price, one in history
  });

  it('handles undefined prices gracefully', async () => {
    const undefinedPriceData = {
      ...mockTrendData,
      currentPrice: undefined,
      priceChange: undefined,
      priceChangePercent: 0,
    };
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(undefinedPriceData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    expect(screen.getByText('$0.00', { selector: '.text-2xl.font-bold' })).toBeInTheDocument();
  });

  it('formats dates correctly', async () => {
    vi.mocked(groceryPriceService.getPriceTrendAnalysis).mockResolvedValue(mockTrendData);

    render(<PriceTrends ingredient={mockIngredient} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Price Trends for chicken breast')).toBeInTheDocument();
    });

    expect(screen.getByText('Last updated: 1/15/2024')).toBeInTheDocument();
  });
});