import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PantryScanner } from '../../../components/pantry/PantryScanner';
import { AppProvider } from '../../../contexts/AppContext';
import { AppActionsProvider } from '../../../contexts/AppActionsContext';
import { PantryItem, LoadingState } from '../../../types';

// Mock Capacitor Camera
vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    DataUrl: 'dataUrl',
  },
  CameraSource: {
    Camera: 'camera',
  },
}));

// Mock Gemini service
vi.mock('../../../services/geminiService', () => ({
  analyzePantryImage: vi.fn(),
}));

describe('PantryScanner Component', () => {
  const mockSetInventory = vi.fn();
  const mockAddToShoppingList = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddItem = vi.fn();
  const mockOnAddItems = vi.fn();
  const mockOnUpdateItem = vi.fn();

  const initialInventory: PantryItem[] = [
    { id: '1', item: 'Milk', category: '', quantity_estimate: '2' },
    { id: '2', item: 'Bread', category: '', quantity_estimate: '1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial inventory', () => {
    render(
      <AppProvider>
        <AppActionsProvider>
          <PantryScanner
            inventory={initialInventory}
            addToShoppingList={mockAddToShoppingList}
            onDeleteItem={mockOnDeleteItem}
            onAddItem={mockOnAddItem}
            onAddItems={mockOnAddItems}
            onUpdateItem={mockOnUpdateItem}
          />
        </AppActionsProvider>
      </AppProvider>
    );

    expect(screen.getAllByText('Milk')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bread')[0]).toBeInTheDocument();
  });

  it('renders the search input placeholder', () => {
    render(
      <AppProvider>
        <AppActionsProvider>
          <PantryScanner
            inventory={initialInventory}
            addToShoppingList={mockAddToShoppingList}
            onDeleteItem={mockOnDeleteItem}
            onAddItem={mockOnAddItem}
            onAddItems={mockOnAddItems}
            onUpdateItem={mockOnUpdateItem}
          />
        </AppActionsProvider>
      </AppProvider>
    );

    expect(screen.getAllByPlaceholderText('Search pantry items...')[0]).toBeInTheDocument();
  });

  it('shows the scan prompt', () => {
    render(
      <AppProvider>
        <AppActionsProvider>
          <PantryScanner
            inventory={[]} // Empty inventory to show scan prompt
            addToShoppingList={mockAddToShoppingList}
            onDeleteItem={mockOnDeleteItem}
            onAddItem={mockOnAddItem}
            onAddItems={mockOnAddItems}
            onUpdateItem={mockOnUpdateItem}
          />
        </AppActionsProvider>
      </AppProvider>
    );

    // The scan prompt is in the Add Items modal, so we need to open the modal first
    const addButton = screen.getAllByLabelText('Add items to pantry')[0];
    fireEvent.click(addButton);

    expect(screen.getAllByText('Scan receipt or pantry')[0]).toBeInTheDocument();
  });
});