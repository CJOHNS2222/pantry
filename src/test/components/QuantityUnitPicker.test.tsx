import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import QuantityUnitPicker from '../../../components/pantry/QuantityUnitPicker';

describe('QuantityUnitPicker Component', () => {
  const mockOnQuantityChange = vi.fn();
  const mockOnUnitChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderPicker = (quantity = 1, unit = 'cups', showControls = true) => {
    return render(
      <QuantityUnitPicker
        quantity={quantity}
        unit={unit}
        onQuantityChange={mockOnQuantityChange}
        onUnitChange={mockOnUnitChange}
        itemName="Flour"
        showControls={showControls}
      />
    );
  };

  it('renders correctly with initial quantity and unit', () => {
    renderPicker();
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
    expect(screen.getByRole('combobox')).toHaveValue('cups');
  });

  it('increments quantity by 0.25', () => {
    renderPicker(1.5, 'cups');
    const plusButton = screen.getByLabelText('Increase quantity');
    fireEvent.click(plusButton);
    // 1.5 + 0.25 = 1.75
    expect(mockOnQuantityChange).toHaveBeenCalledWith(1.75);
  });

  it('decrements quantity by 0.25', () => {
    renderPicker(1.5, 'cups');
    const minusButton = screen.getByLabelText('Decrease quantity');
    fireEvent.click(minusButton);
    // 1.5 - 0.25 = 1.25
    expect(mockOnQuantityChange).toHaveBeenCalledWith(1.25);
  });

  it('shows fraction quick-picks for fractional units', () => {
    renderPicker(1.5, 'cups'); // 'cups' is a fractional unit
    expect(screen.getByText('¼')).toBeInTheDocument();
    expect(screen.getByText('½')).toBeInTheDocument();
    expect(screen.getByText('¾')).toBeInTheDocument();
  });

  it('hides fraction quick-picks for non-fractional units', () => {
    renderPicker(1.5, 'pieces'); // 'pieces' is not a fractional unit in FRACTIONAL_UNITS Set
    expect(screen.queryByText('¼')).not.toBeInTheDocument();
    expect(screen.queryByText('½')).not.toBeInTheDocument();
    expect(screen.queryByText('¾')).not.toBeInTheDocument();
  });
});
