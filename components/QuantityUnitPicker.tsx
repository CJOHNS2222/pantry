import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityUnitPickerProps {
  quantity: number;
  unit: string;
  onQuantityChange: (quantity: number) => void;
  onUnitChange: (unit: string) => void;
  itemName?: string;
  className?: string;
  showControls?: boolean;
  maxQuantity?: number;
}

const COMMON_UNITS = [
  'count', 'pieces', 'lbs', 'kg', 'oz', 'g', 'cups', 'tbsp', 'tsp', 'ml', 'l', 'gallons', 'quarts', 'pints',
  'dozen', 'loaves', 'cans', 'bottles', 'bags', 'boxes', 'packages', 'slices', 'sticks', 'heads'
];

const QuantityUnitPicker: React.FC<QuantityUnitPickerProps> = ({
  quantity,
  unit,
  onQuantityChange,
  onUnitChange,
  itemName = '',
  className = '',
  showControls = true,
  maxQuantity = 100
}) => {
  const [localQuantity, setLocalQuantity] = useState(quantity.toString());

  // Update local quantity when prop changes
  useEffect(() => {
    setLocalQuantity(quantity.toString());
  }, [quantity]);

  // Get smart unit suggestions based on item name
  const getSmartUnits = (itemName: string) => {
    const name = itemName.toLowerCase();

    // Beverages and liquids
    if (name.includes('milk') || name.includes('juice') || name.includes('soda') ||
        name.includes('water') || name.includes('coffee') || name.includes('tea') ||
        name.includes('oil') || name.includes('vinegar')) {
      return ['gallons', 'quarts', 'pints', 'cups', 'ml', 'l', 'bottles'];
    }

    // Bread and baked goods
    if (name.includes('bread') || name.includes('loaf') || name.includes('baguette') ||
        name.includes('roll') || name.includes('bun') || name.includes('cake') ||
        name.includes('pie')) {
      return ['loaves', 'pieces', 'slices'];
    }

    // Eggs
    if (name.includes('egg')) {
      return ['dozen', 'count', 'pieces'];
    }

    // Cheese
    if (name.includes('cheese')) {
      return ['lbs', 'kg', 'oz', 'g', 'blocks', 'pieces'];
    }

    // Pasta, rice, grains
    if (name.includes('pasta') || name.includes('rice') || name.includes('quinoa') ||
        name.includes('oat') || name.includes('cereal') || name.includes('flour') ||
        name.includes('sugar')) {
      return ['lbs', 'kg', 'oz', 'g', 'cups', 'bags', 'boxes'];
    }

    // Fruits and vegetables
    if (name.includes('apple') || name.includes('orange') || name.includes('banana') ||
        name.includes('tomato') || name.includes('potato') || name.includes('onion') ||
        name.includes('carrot') || name.includes('lettuce') || name.includes('garlic') ||
        name.includes('ginger')) {
      return ['count', 'pieces', 'lbs', 'kg', 'heads', 'bunches'];
    }

    // Meat and proteins
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') ||
        name.includes('fish') || name.includes('turkey') || name.includes('sausage') ||
        name.includes('bacon')) {
      return ['lbs', 'kg', 'oz', 'g', 'pieces'];
    }

    // Canned goods
    if (name.includes('can') || name.includes('tin') || name.includes('soup') ||
        name.includes('bean') || name.includes('corn') || name.includes('peas') ||
        name.includes('tomato') || name.includes('tuna')) {
      return ['cans', 'count', 'pieces'];
    }

    // Snacks
    if (name.includes('chip') || name.includes('cracker') || name.includes('cookie') ||
        name.includes('candy') || name.includes('chocolate') || name.includes('nut')) {
      return ['bags', 'boxes', 'lbs', 'kg', 'oz', 'g'];
    }

    // Spices and seasonings
    if (name.includes('salt') || name.includes('pepper') || name.includes('spice') ||
        name.includes('herb') || name.includes('seasoning')) {
      return ['tbsp', 'tsp', 'cups', 'oz', 'g'];
    }

    // Default units
    return ['count', 'pieces', 'lbs', 'cups'];
  };

  const smartUnits = getSmartUnits(itemName);

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuantity(value);

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= maxQuantity) {
      onQuantityChange(numValue);
    }
  };

  const handleQuantityBlur = () => {
    const numValue = parseFloat(localQuantity);
    if (isNaN(numValue) || numValue < 0) {
      setLocalQuantity(quantity.toString());
    } else if (numValue > maxQuantity) {
      setLocalQuantity(maxQuantity.toString());
      onQuantityChange(maxQuantity);
    } else {
      onQuantityChange(numValue);
    }
  };

  const handleIncrement = () => {
    const newQuantity = Math.min(quantity + 1, maxQuantity);
    onQuantityChange(newQuantity);
  };

  const handleDecrement = () => {
    const newQuantity = Math.max(quantity - 1, 0);
    onQuantityChange(newQuantity);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Quantity Input with Controls */}
      <div className="flex items-center gap-1">
        {showControls && (
          <button
            onClick={handleDecrement}
            disabled={quantity <= 0}
            className="w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        )}

        <input
          type="number"
          min="0"
          max={maxQuantity}
          step="0.25"
          value={localQuantity}
          onChange={handleQuantityInputChange}
          onBlur={handleQuantityBlur}
          className="w-16 px-2 py-2 text-center bg-theme-secondary border border-theme rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
        />

        {showControls && (
          <button
            onClick={handleIncrement}
            disabled={quantity >= maxQuantity}
            className="w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Unit Selector */}
      <select
        value={unit}
        onChange={(e) => onUnitChange(e.target.value)}
        className="flex-1 px-3 py-2 bg-theme-secondary border border-theme rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent"
      >
        {smartUnits.map(unitOption => (
          <option key={unitOption} value={unitOption}>
            {unitOption}
          </option>
        ))}
        {/* Add other common units not in smart units */}
        {COMMON_UNITS.filter(u => !smartUnits.includes(u)).map(unitOption => (
          <option key={unitOption} value={unitOption}>
            {unitOption}
          </option>
        ))}
      </select>
    </div>
  );
};

export default QuantityUnitPicker;