import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PantryScanner } from '../../../components/PantryScanner';
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

  const initialInventory: PantryItem[] = [
    { id: '1', item: 'Milk', category: '', quantity_estimate: '2' },
    { id: '2', item: 'Bread', category: '', quantity_estimate: '1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial inventory', () => {
    render(
      <PantryScanner
        inventory={initialInventory}
        setInventory={mockSetInventory}
        addToShoppingList={mockAddToShoppingList}
      />
    );

    expect(screen.getAllByText('Milk')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bread')[0]).toBeInTheDocument();
  });

  it('renders the component title', () => {
    render(
      <PantryScanner
        inventory={initialInventory}
        setInventory={mockSetInventory}
        addToShoppingList={mockAddToShoppingList}
      />
    );

    expect(screen.getAllByText('My Pantry')[0]).toBeInTheDocument();
  });

  it('shows the scan prompt', () => {
    render(
      <PantryScanner
        inventory={[]} // Empty inventory to show scan prompt
        setInventory={mockSetInventory}
        addToShoppingList={mockAddToShoppingList}
      />
    );

    // The scan prompt is in the Add Items modal, so we need to open the modal first
    const addButton = screen.getAllByLabelText('Add items to pantry')[0];
    fireEvent.click(addButton);

    expect(screen.getAllByText('Scan receipt or pantry')[0]).toBeInTheDocument();
  });
});