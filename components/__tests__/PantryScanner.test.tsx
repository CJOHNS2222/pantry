import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// Explicit Vitest imports to avoid relying on globals in some CI/test setups
import { vi, describe, test, expect } from 'vitest';
import { PantryScanner } from '../PantryScanner';

function makeItem(i: number) {
  return {
    id: `item-${i}`,
    item: `Item ${i}`,
    image: '/images/placeholder.svg',
    quantity_estimate: '1',
    category: 'Manual',
    storageLocation: 'pantry',
  };
}

describe('PantryScanner bulk behavior and virtualization', () => {
  test('bulk change location calls setInventory with updated items', async () => {
    const inventory = [makeItem(1), makeItem(2), makeItem(3)];
    const mockSetInventory = vi.fn();
    const addToShoppingList = vi.fn();

    render(
      <PantryScanner
        inventory={inventory}
        setInventory={mockSetInventory}
        addToShoppingList={addToShoppingList}
      />
    );

    // Click Select Multiple
    const selectBtn = screen.getAllByRole('button', { name: /Select Multiple/i })[0];
    fireEvent.click(selectBtn);

    // Check first checkbox
    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // Change the bulk location select to 'fridge'
    const moveOption = screen.getAllByText('Move to Pantry')[0];
    const combobox = moveOption.closest('select');
    expect(combobox).not.toBeNull();
    if (combobox) fireEvent.change(combobox, { target: { value: 'fridge' } });

    // Expect setInventory called at least once
    expect(mockSetInventory).toHaveBeenCalled();
    const callArg = mockSetInventory.mock.calls[0][0];
    if (Array.isArray(callArg)) {
      const updated = callArg;
      expect(updated[0].storageLocation).toBe('fridge');
    }
  });

  test('virtualized render does not crash with many items', () => {
    const many = Array.from({ length: 120 }).map((_, i) => makeItem(i));
    const mockSetInventory = vi.fn();
    const addToShoppingList = vi.fn();

    render(
      <PantryScanner
        inventory={many}
        setInventory={mockSetInventory}
        addToShoppingList={addToShoppingList}
      />
    );

    const matches = screen.getAllByText(/Item 0|Item 1/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
