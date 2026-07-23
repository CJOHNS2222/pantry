// components/VisualQuantitySelector.tsx
import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface VisualQuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  itemName?: string;
  unit?: string;
  maxValue?: number;
  showTypicalAmounts?: boolean;
  showVisualLevels?: boolean;
  step?: number;
  minValue?: number;
  className?: string;
}

const QUANTITY_LEVELS = [
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
  showVisualLevels = true,
  step = 0.25,
  minValue = 0.25,
  className = ''
}) => {
  const [_isDragging, setIsDragging] = useState(false);

  // Get appropriate unit based on item name
  const getSmartUnit = (itemName: string) => {
    const name = itemName.toLowerCase();
    
    // Beverages and liquids
    if (name.includes('milk') || name.includes('juice') || name.includes('soda') || 
        name.includes('water') || name.includes('coffee') || name.includes('tea')) {
      return 'gallons';
    }
    
    // Bread and baked goods
    if (name.includes('bread') || name.includes('loaf') || name.includes('baguette') || 
        name.includes('roll') || name.includes('bun')) {
      return 'loaves';
    }
    
    // Eggs
    if (name.includes('egg')) {
      return 'dozen';
    }
    
    // Cheese
    if (name.includes('cheese')) {
      return 'lbs';
    }
    
    // Pasta, rice, grains
    if (name.includes('pasta') || name.includes('rice') || name.includes('quinoa') || 
        name.includes('oat') || name.includes('cereal')) {
      return 'lbs';
    }
    
    // Fruits and vegetables (often counted individually)
    if (name.includes('apple') || name.includes('orange') || name.includes('banana') || 
        name.includes('tomato') || name.includes('potato') || name.includes('onion') || 
        name.includes('carrot') || name.includes('lettuce')) {
      return 'pieces';
    }
    
    // Meat and proteins
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
        name.includes('fish') || name.includes('turkey') || name.includes('sausage')) {
      return 'lbs';
    }
    
    // Canned goods
    if (name.includes('can') || name.includes('tin') || name.includes('soup') || 
        name.includes('bean') || name.includes('corn') || name.includes('peas')) {
      return 'cans';
    }
    
    // Snacks
    if (name.includes('chip') || name.includes('cracker') || name.includes('cookie') || 
        name.includes('candy') || name.includes('chocolate')) {
      return 'bags';
    }
    
    // Default fallback
    return 'items';
  };

  // Get typical amounts for common items
  const getTypicalAmounts = (itemName: string) => {
    const name = itemName.toLowerCase();
    const smartUnit = getSmartUnit(itemName);
    
    if (name.includes('milk') || name.includes('juice')) return ['1 quart', '½ gallon', '1 gallon'];
    if (name.includes('bread') || name.includes('loaf')) return ['1 loaf', '2 loaves', '3 loaves'];
    if (name.includes('egg')) return ['½ dozen', '1 dozen', '2 dozen'];
    if (name.includes('cheese')) return ['4 oz', '8 oz', '1 lb'];
    if (name.includes('pasta') || name.includes('rice')) return ['1 lb', '2 lbs', '5 lbs'];
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork')) return ['1 lb', '2 lbs', '3 lbs'];
    if (name.includes('apple') || name.includes('orange')) return ['3 pieces', '6 pieces', '12 pieces'];
    if (name.includes('potato') || name.includes('onion') || name.includes('carrot')) return ['2 lbs', '5 lbs', '10 lbs'];
    if (name.includes('can') || name.includes('soup') || name.includes('bean')) return ['2 cans', '6 cans', '12 cans'];
    if (name.includes('chip') || name.includes('cracker')) return ['1 bag', '2 bags', '3 bags'];
    
    // Generic fallback based on smart unit
    if (smartUnit === 'lbs') return ['1 lb', '2 lbs', '5 lbs'];
    if (smartUnit === 'pieces') return ['2 pieces', '6 pieces', '12 pieces'];
    if (smartUnit === 'cans') return ['2 cans', '6 cans', '12 cans'];
    if (smartUnit === 'bags') return ['1 bag', '2 bags', '3 bags'];
    if (smartUnit === 'loaves') return ['1 loaf', '2 loaves', '3 loaves'];
    if (smartUnit === 'dozen') return ['½ dozen', '1 dozen', '2 dozen'];
    if (smartUnit === 'gallons') return ['1 quart', '½ gallon', '1 gallon'];
    
    return ['1', '2', '3'];
  };

  // Get appropriate max value based on item name
  const getSmartMaxValue = (itemName: string) => {
    const name = itemName.toLowerCase();
    
    // Beverages and liquids (people don't stockpile these as much)
    if (name.includes('milk') || name.includes('juice') || name.includes('soda') || 
        name.includes('water') || name.includes('coffee') || name.includes('tea')) {
      return 4; // 4 gallons max
    }
    
    // Bread and baked goods
    if (name.includes('bread') || name.includes('loaf') || name.includes('baguette') || 
        name.includes('roll') || name.includes('bun')) {
      return 4; // 4 loaves max
    }
    
    // Eggs
    if (name.includes('egg')) {
      return 4; // 4 dozen max
    }
    
    // Cheese
    if (name.includes('cheese')) {
      return 4; // 4 lbs max
    }
    
    // Pasta, rice, grains
    if (name.includes('pasta') || name.includes('rice') || name.includes('quinoa') || 
        name.includes('oat') || name.includes('cereal')) {
      return 6; // 6 lbs max
    }
    
    // Fruits and vegetables (often counted individually)
    if (name.includes('apple') || name.includes('orange') || name.includes('banana') || 
        name.includes('tomato') || name.includes('potato') || name.includes('onion') || 
        name.includes('carrot') || name.includes('lettuce')) {
      return 12; // 12 pieces max
    }
    
    // Meat and proteins
    if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
        name.includes('fish') || name.includes('turkey') || name.includes('sausage')) {
      return 6; // 6 lbs max
    }
    
    // Canned goods (as user mentioned, 10 max)
    if (name.includes('can') || name.includes('tin') || name.includes('soup') || 
        name.includes('bean') || name.includes('corn') || name.includes('peas')) {
      return 10; // 10 cans max
    }
    
    // Snacks
    if (name.includes('chip') || name.includes('cracker') || name.includes('cookie') || 
        name.includes('candy') || name.includes('chocolate')) {
      return 6; // 6 bags max
    }
    
    // Default fallback
    return 4; // 4 items max for most things
  };

  const smartUnit = getSmartUnit(itemName);
  const smartMaxValue = maxValue === 10 ? getSmartMaxValue(itemName) : (maxValue || 10);
  const displayUnit = unit === 'items' ? smartUnit : unit;
  const typicalAmounts = showTypicalAmounts ? getTypicalAmounts(itemName) : [];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  const stepValue = (typeof step === 'number' && isFinite(step) && step > 0) ? step : 0.25;
  const minVal = (typeof minValue === 'number' && isFinite(minValue) && minValue >= 0) ? minValue : 0.25;

  // Ensure `value` is a safe number to avoid NaN/Infinity propagation
  const safeValue = (typeof value === 'number' && isFinite(value)) ? value : minVal;

  const handleIncrement = () => {
    if (stepValue === 0) return onChange(safeValue);
    const rounded = Math.round((safeValue + stepValue) / stepValue) * stepValue;
    const newValue = Math.min(smartMaxValue, rounded || minVal);
    onChange(Number(newValue.toFixed(3)));
  };

  const handleDecrement = () => {
    if (stepValue === 0) return onChange(safeValue);
    const rounded = Math.round((safeValue - stepValue) / stepValue) * stepValue;
    const newValue = Math.max(minVal, rounded || minVal);
    onChange(Number(newValue.toFixed(3)));
  };

  const handleLevelClick = (levelValue: number) => {
    onChange(levelValue);
  };

  // Find current level
  const getCurrentLevel = () => {
    if (value === 0) return QUANTITY_LEVELS[0];
    if (value <= 0.25) return QUANTITY_LEVELS[0];
    if (value <= 0.5) return QUANTITY_LEVELS[1];
    if (value <= 0.75) return QUANTITY_LEVELS[2];
    return QUANTITY_LEVELS[3]; // Full or more than full
  };

  const currentLevel = getCurrentLevel();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Visual Level Indicators */}
      {showVisualLevels && (
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
      )}

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-theme-secondary">
          <span>Quantity</span>
          <span className="font-medium text-theme-primary">
            {value} {displayUnit}
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min={minVal}
            max={smartMaxValue}
            step={stepValue}
            value={value}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            className="w-full h-2 bg-theme-secondary rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-theme-secondary mt-1">
            <span>1</span>
            <span>{smartMaxValue}</span>
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

        {showVisualLevels ? (
          <div className="flex flex-col items-center">
            <span className="text-2xl">{currentLevel.icon}</span>
            <span className="text-sm font-medium text-theme-primary">{currentLevel.label}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-theme-primary">{value}</span>
            <span className="text-sm text-theme-secondary">{displayUnit}</span>
          </div>
        )}

        <button
          onClick={handleIncrement}
          disabled={value >= smartMaxValue}
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