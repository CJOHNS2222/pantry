import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ItemDetailModal from '../../../components/pantry/ItemDetailModal';
import { PantryItem } from '../../../types';

// Mock react-intl
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

// Mock AppContext
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    household: { id: 'household1' },
    user: { id: 'user-1', name: 'Test User' },
    settings: {
      shopping: { showNutrition: true }
    }
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

// Mock imageService
vi.mock('../../../services/imageService', () => ({
  uploadItemImage: vi.fn(),
}));

// Mock nutritionService
vi.mock('../../../services/nutritionService', () => ({
  getNutritionFactsWithFallback: vi.fn().mockResolvedValue(null),
}));

describe('ItemDetailModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdateItem = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddToShoppingList = vi.fn();

  const mockItem: PantryItem = {
    id: 'test-1',
    item: 'Chicken Breast',
    category: 'Meat',
    quantity: { amount: 6, unit: 'pieces' },
    quantity_estimate: '6',
    storageLocation: 'fridge',
    expirationDate: '2035-12-31' // future date (not expired)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderModal = (item: PantryItem = mockItem) => {
    return render(
      <ItemDetailModal
        item={item}
        onClose={mockOnClose}
        onUpdateItem={mockOnUpdateItem}
        onDeleteItem={mockOnDeleteItem}
        onAddToShoppingList={mockOnAddToShoppingList}
        customCategories={[]}
        originalIndex={0}
      />
    );
  };

  it('renders correctly with item details', () => {
    renderModal();
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
    expect(screen.getByText('6 pieces')).toBeInTheDocument();
  });

  it('increments quantity by 0.25', () => {
    renderModal();
    const plusButton = screen.getByTestId('item-qty-plus');
    fireEvent.click(plusButton);
    // 6 + 0.25 = 6.25
    expect(screen.getByText('6.25 pieces')).toBeInTheDocument();
  });

  it('decrements quantity by 0.25', () => {
    renderModal();
    const minusButton = screen.getByTestId('item-qty-minus');
    fireEvent.click(minusButton);
    // 6 - 0.25 = 5.75
    expect(screen.getByText('5.75 pieces')).toBeInTheDocument();
  });

  it('portion selector 1/2 button sets quantity to half of baseQuantity (3 instead of 0.5)', () => {
    renderModal();
    const halfButton = screen.getByTestId('item-visual-half');
    fireEvent.click(halfButton);
    expect(screen.getByText('3 pieces')).toBeInTheDocument();
  });

  it('portion selector 1/4 button sets quantity to quarter of baseQuantity (1.5 instead of 0.25)', () => {
    renderModal();
    const quarterButton = screen.getByTestId('item-visual-quarter');
    fireEvent.click(quarterButton);
    expect(screen.getByText('1.5 pieces')).toBeInTheDocument();
  });

  it('closing modal when empty or 0 quantity deletes the item with cooked reason (if not expired)', () => {
    renderModal();
    const emptyButton = screen.getByTestId('item-visual-empty');
    fireEvent.click(emptyButton);
    
    // Trigger save/close
    const closeButton = screen.getByTestId('item-close');
    fireEvent.click(closeButton);

    expect(mockOnDeleteItem).toHaveBeenCalledWith(0, 'cooked');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closing modal when empty or 0 quantity deletes the item with thrown_away reason (if expired)', () => {
    const expiredItem = {
      ...mockItem,
      expirationDate: '2020-01-01' // past date
    };
    renderModal(expiredItem);
    const emptyButton = screen.getByTestId('item-visual-empty');
    fireEvent.click(emptyButton);
    
    // Trigger save/close
    const closeButton = screen.getByTestId('item-close');
    fireEvent.click(closeButton);

    expect(mockOnDeleteItem).toHaveBeenCalledWith(0, 'thrown_away');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clicking trash button deletes item immediately with remove reason (if not expired)', () => {
    renderModal();
    const deleteButton = screen.getByTestId('item-delete');
    fireEvent.click(deleteButton);

    expect(mockOnDeleteItem).toHaveBeenCalledWith(0, 'remove');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('clicking trash button deletes item immediately with thrown_away reason (if expired)', () => {
    const expiredItem = {
      ...mockItem,
      expirationDate: '2020-01-01' // past date
    };
    renderModal(expiredItem);
    const deleteButton = screen.getByTestId('item-delete');
    fireEvent.click(deleteButton);

    expect(mockOnDeleteItem).toHaveBeenCalledWith(0, 'thrown_away');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
