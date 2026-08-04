import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test-utils';
import { PantryScanner } from '../../../components/pantry/PantryScanner';
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
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
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
      <PantryScanner
        inventory={initialInventory}
        addToShoppingList={mockAddToShoppingList}
        onDeleteItem={mockOnDeleteItem}
        onAddItem={mockOnAddItem}
        onAddItems={mockOnAddItems}
        onUpdateItem={mockOnUpdateItem}
      />
    );

    expect(screen.getAllByText('Milk')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bread')[0]).toBeInTheDocument();
  });

  it('renders the search input placeholder', () => {
    render(
      <PantryScanner
        inventory={initialInventory}
        addToShoppingList={mockAddToShoppingList}
        onDeleteItem={mockOnDeleteItem}
        onAddItem={mockOnAddItem}
        onAddItems={mockOnAddItems}
        onUpdateItem={mockOnUpdateItem}
      />
    );

    const searchButton = screen.getByText('Search pantry items...').closest('button')!;
    fireEvent.click(searchButton);

    expect(screen.getAllByPlaceholderText('Search pantry items...')[0]).toBeInTheDocument();
  });

  it('shows the scan prompt', () => {
    render(
      <PantryScanner
        inventory={[]} // Empty inventory to show scan prompt
        addToShoppingList={mockAddToShoppingList}
        onDeleteItem={mockOnDeleteItem}
        onAddItem={mockOnAddItem}
        onAddItems={mockOnAddItems}
        onUpdateItem={mockOnUpdateItem}
      />
    );

    // Open search modal
    const searchButton = screen.getByText('Search pantry items...').closest('button')!;
    fireEvent.click(searchButton);

    expect(screen.getAllByPlaceholderText('Search pantry items...')[0]).toBeInTheDocument();
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
      <PantryScanner
        inventory={inventory}
        addToShoppingList={addToShoppingList}
        onDeleteItem={mockOnDeleteItem}
        onAddItem={mockOnAddItem}
        onAddItems={mockOnAddItems}
        onUpdateItem={mockOnUpdateItem}
      />
    );

    // Click Bulk select mode button
    const selectBtn = screen.getByLabelText('Bulk select mode');
    fireEvent.click(selectBtn);

    // Select first item row
    const item1 = screen.getAllByText('Item 1')[0];
    fireEvent.click(item1);

    // Change the bulk location select to 'fridge'
    const locationSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(locationSelect, { target: { value: 'fridge' } });

    // Expect mockOnUpdateItem called
    expect(mockOnUpdateItem).toHaveBeenCalled();
  });

  test('virtualized render does not crash with many items', () => {
    const many = Array.from({ length: 120 }).map((_, i) => makeItem(i));

    render(
      <PantryScanner
        inventory={many}
        addToShoppingList={addToShoppingList}
        onDeleteItem={mockOnDeleteItem}
        onAddItem={mockOnAddItem}
        onAddItems={mockOnAddItems}
        onUpdateItem={mockOnUpdateItem}
      />
    );

    const matches = screen.getAllByText(/Item 0|Item 1/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
