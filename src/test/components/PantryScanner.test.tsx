import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PantryScanner } from '../../../components/pantry/PantryScanner';
import { AppProvider } from '../../../contexts/AppContext';
import { AppActionsProvider } from '../../../contexts/AppActionsContext';
import { PantryItem } from '../../../types';

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

// Mock IntersectionObserver for JSDOM
beforeEach(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver = MockIntersectionObserver as any;
  vi.clearAllMocks();
});

// Without this, prior tests' rendered PantryScanner instances stay mounted, so
// getAllByRole(...)[0] queries can pick up buttons from a stale render with a
// different mock closure — causing assertions to check the wrong mock.
afterEach(() => {
  cleanup();
});

function makeItem(i: number): PantryItem {
  return {
    id: `item-${i}`,
    item: `Item ${i}`,
    image: '/images/placeholder.svg',
    quantity_estimate: '1',
    category: 'Manual',
    storageLocation: 'pantry',
  } as PantryItem;
}

describe('PantryScanner Component', () => {
  const mockAddToShoppingList = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddItem = vi.fn();
  const mockOnAddItems = vi.fn();
  const mockOnUpdateItem = vi.fn();

  const initialInventory: PantryItem[] = [
    { id: '1', item: 'Milk', category: '', quantity_estimate: '2' } as PantryItem,
    { id: '2', item: 'Bread', category: '', quantity_estimate: '1' } as PantryItem,
  ];

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

    // The search input lives in a modal opened via the "Search items" button —
    // it isn't rendered inline in the item list view.
    const searchButton = screen.getAllByLabelText('Search items')[0];
    fireEvent.click(searchButton);

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

describe('PantryScanner bulk behavior and virtualization', () => {
  const addToShoppingList = vi.fn();
  const mockOnDeleteItem = vi.fn();
  const mockOnAddItem = vi.fn();
  const mockOnAddItems = vi.fn();
  const mockOnUpdateItem = vi.fn();

  test('bulk change location calls setInventory with updated items', async () => {
    const inventory = [makeItem(1), makeItem(2), makeItem(3)];

    render(
      <AppProvider>
        <AppActionsProvider>
          <PantryScanner
            inventory={inventory}
            addToShoppingList={addToShoppingList}
            onDeleteItem={mockOnDeleteItem}
            onAddItem={mockOnAddItem}
            onAddItems={mockOnAddItems}
            onUpdateItem={mockOnUpdateItem}
          />
        </AppActionsProvider>
      </AppProvider>
    );

    // Click Select Multiple (match visible text or aria-label)
    const selectBtn = screen.getAllByRole('button', { name: /Select Multiple|Enter bulk selection mode/i })[0];
    fireEvent.click(selectBtn);

    // Check first checkbox
    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // Change the bulk location select to 'fridge' (select shows 'Change Location')
    const moveOption = screen.getAllByText('Change Location')[0];
    const combobox = moveOption.closest('select');
    expect(combobox).not.toBeNull();
    if (combobox) fireEvent.change(combobox, { target: { value: 'fridge' } });

    // Expect setInventory called at least once
    expect(mockOnUpdateItem).toHaveBeenCalled();
  });

  test('virtualized render does not crash with many items', () => {
    const many = Array.from({ length: 120 }).map((_, i) => makeItem(i));

    render(
      <AppProvider>
        <AppActionsProvider>
          <PantryScanner
            inventory={many}
            addToShoppingList={addToShoppingList}
            onDeleteItem={mockOnDeleteItem}
            onAddItem={mockOnAddItem}
            onAddItems={mockOnAddItems}
            onUpdateItem={mockOnUpdateItem}
          />
        </AppActionsProvider>
      </AppProvider>
    );

    const matches = screen.getAllByText(/Item 0|Item 1/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
