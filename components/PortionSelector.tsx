import React, { useState, useEffect } from 'react';
import { Users, Minus, Plus, ChefHat } from 'lucide-react';
import { Household } from '../types';
import { calculatePortionScaling, PORTION_PRESETS, getRecommendedServings, PortionConfig } from '../utils/portionUtils';

interface PortionSelectorProps {
  household: Household | null;
  currentServings: number;
  onPortionChange: (newServings: number, scaledIngredients: string[]) => void;
  originalIngredients: string[];
  className?: string;
}

export const PortionSelector: React.FC<PortionSelectorProps> = ({
  household,
  currentServings,
  onPortionChange,
  originalIngredients,
  className = ''
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('smallFamily');
  const [customServings, setCustomServings] = useState<number>(currentServings);

  // Calculate current portion config
  const portionConfig = calculatePortionScaling(household, currentServings);

  // Update when household changes
  useEffect(() => {
    const recommendedServings = getRecommendedServings(household);
    setCustomServings(recommendedServings);

    // Find best preset match
    let bestPreset = 'smallFamily';
    let minDifference = Math.abs((household?.members?.length || 1) - PORTION_PRESETS.smallFamily.householdSize);

    for (const [key, preset] of Object.entries(PORTION_PRESETS)) {
      const difference = Math.abs((household?.members?.length || 1) - preset.householdSize);
      if (difference < minDifference) {
        minDifference = difference;
        bestPreset = key;
      }
    }

    setSelectedPreset(bestPreset);
  }, [household]);

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = PORTION_PRESETS[presetKey as keyof typeof PORTION_PRESETS];
    const newServings = Math.round(currentServings * preset.scalingFactor);

    // Scale ingredients based on the preset
    const scalingFactor = preset.scalingFactor;
    const scaledIngredients = originalIngredients.map(ingredient => {
      // Simple scaling logic - could be enhanced
      const quantityMatch = ingredient.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(.+)$/);
      if (quantityMatch) {
        const [, qtyStr, rest] = quantityMatch;
        const quantity = parseFloat(qtyStr);
        if (!isNaN(quantity)) {
          const scaledQuantity = quantity * scalingFactor;
          return `${scaledQuantity} ${rest}`;
        }
      }
      return ingredient;
    });

    onPortionChange(newServings, scaledIngredients);
  };

  const handleCustomServingsChange = (newServings: number) => {
    if (newServings < 1) return;
    setCustomServings(newServings);

    // Calculate scaling factor relative to original servings
    const scalingFactor = newServings / currentServings;

    // Scale ingredients
    const scaledIngredients = originalIngredients.map(ingredient => {
      const quantityMatch = ingredient.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(.+)$/);
      if (quantityMatch) {
        const [, qtyStr, rest] = quantityMatch;
        const quantity = parseFloat(qtyStr);
        if (!isNaN(quantity)) {
          const scaledQuantity = quantity * scalingFactor;
          return `${scaledQuantity} ${rest}`;
        }
      }
      return ingredient;
    });

    onPortionChange(newServings, scaledIngredients);
  };

  const householdSize = household?.members?.length || 1;

  return (
    <div className={`bg-theme-secondary/50 rounded-lg p-4 border border-theme ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[var(--accent-color)]" />
        <h3 className="text-sm font-semibold text-theme-primary">Portion Size</h3>
        <span className="text-xs text-theme-secondary bg-theme-primary px-2 py-1 rounded-full">
          {householdSize} {householdSize === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(PORTION_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              selectedPreset === key
                ? 'bg-[var(--accent-color)] text-white shadow-md'
                : 'bg-theme-primary text-theme-primary hover:bg-theme-secondary'
            }`}
          >
            <div className="text-center">
              <div className="font-semibold">
                {key === 'single' && '1 Person'}
                {key === 'couple' && '2 People'}
                {key === 'smallFamily' && '4 People'}
                {key === 'largeFamily' && '6 People'}
                {key === 'extendedFamily' && '8 People'}
              </div>
              <div className="text-xs opacity-75">
                {Math.round(currentServings * preset.scalingFactor)} servings
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Servings Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-theme-primary">Custom servings:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCustomServingsChange(customServings - 1)}
            className="p-1 rounded bg-theme-primary hover:bg-theme-secondary transition-colors"
            disabled={customServings <= 1}
          >
            <Minus className="w-4 h-4 text-theme-primary" />
          </button>
          <span className="text-sm font-semibold text-theme-primary min-w-[2rem] text-center">
            {customServings}
          </span>
          <button
            onClick={() => handleCustomServingsChange(customServings + 1)}
            className="p-1 rounded bg-theme-primary hover:bg-theme-secondary transition-colors"
          >
            <Plus className="w-4 h-4 text-theme-primary" />
          </button>
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700 dark:text-green-300">
            Recommended: {getRecommendedServings(household)} servings for your household
          </span>
        </div>
      </div>
    </div>
  );
};