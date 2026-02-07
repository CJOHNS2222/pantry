// components/VisualQuantitySelector.tsx
import React, { useState, useEffect } from 'react';
import { Droplet, Minus, Plus } from 'lucide-react';

interface VisualQuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  itemName?: string;
  unit?: string;
  maxValue?: number;
  showTypicalAmounts?: boolean;
  className?: string;
}

const QUANTITY_LEVELS = [
  { value: 0, label: 'Empty', icon: '🫗', color: 'text-red-500' },
  { value: 0.25, label: 'Quarter', icon: '🥛', color: 'text-orange-500' },
  { value: 0.5, label: 'Half', icon: '🥛', color: 'text-yellow-500' },
  { value: 0.75, label: 'Three Quarter', icon: '🥛', color: 'text-blue-500' },
  { value: 1, label: 'Full', icon: '🥛', color: 'text-green-500' },
];

const VisualQuantitySelector: React.FC<VisualQuantitySelectorProps> = ({
  value,
  onChange,
  itemName = '',
  unit = 'items',
  maxValue = 10,
  showTypicalAmounts = true,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Get typical amounts for common items
  const getTypicalAmounts = (itemName: string) => {
    const name = itemName.toLowerCase();
    if (name.includes('milk') || name.includes('juice')) return ['1 quart', '½ gallon', '1 gallon'];
    if (name.includes('bread') || name.includes('eggs')) return ['6', '12', '24'];
    if (name.includes('cheese')) return ['4 oz', '8 oz', '16 oz'];
    if (name.includes('pasta') || name.includes('rice')) return ['1 lb', '2 lb', '5 lb'];
    return ['1', '2', '3'];
  };

  const typicalAmounts = showTypicalAmounts ? getTypicalAmounts(itemName) : [];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(maxValue, value + 1);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, value - 1);
    onChange(newValue);
  };

  const handleLevelClick = (levelValue: number) => {
    onChange(levelValue);
  };

  // Find current level
  const getCurrentLevel = () => {
    if (value === 0) return QUANTITY_LEVELS[0];
    if (value <= 0.25) return QUANTITY_LEVELS[1];
    if (value <= 0.5) return QUANTITY_LEVELS[2];
    if (value <= 0.75) return QUANTITY_LEVELS[3];
    return QUANTITY_LEVELS[4];
  };

  const currentLevel = getCurrentLevel();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Visual Level Indicators */}
      <div className="flex items-center justify-between">
        {QUANTITY_LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => handleLevelClick(level.value)}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              Math.abs(value - level.value) < 0.1
                ? 'bg-[var(--accent-color)] text-white'
                : 'hover:bg-theme-secondary'
            }`}
          >
            <span className="text-2xl mb-1">{level.icon}</span>
            <span className="text-xs font-medium">{level.label}</span>
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-theme-secondary">
          <span>Quantity</span>
          <span className="font-medium text-theme-primary">
            {value} {unit}
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min="0"
            max={maxValue}
            step="0.25"
            value={value}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            className="w-full h-2 bg-theme-secondary rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-theme-secondary mt-1">
            <span>0</span>
            <span>{maxValue}</span>
          </div>
        </div>
      </div>

      {/* Plus/Minus Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleDecrement}
          disabled={value <= 0}
          className="w-10 h-10 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-2xl">{currentLevel.icon}</span>
          <span className="text-sm font-medium text-theme-primary">{currentLevel.label}</span>
        </div>

        <button
          onClick={handleIncrement}
          disabled={value >= maxValue}
          className="w-10 h-10 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-primary hover:bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Typical Amounts */}
      {showTypicalAmounts && typicalAmounts.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-theme-secondary">Typical amounts:</span>
          <div className="flex flex-wrap gap-2">
            {typicalAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  const numAmount = parseFloat(amount.split(' ')[0]) || 1;
                  onChange(numAmount);
                }}
                className="px-3 py-1 text-sm bg-theme-secondary text-theme-primary rounded-lg hover:bg-theme-primary hover:text-theme-secondary transition-colors"
              >
                {amount}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualQuantitySelector;