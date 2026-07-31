import React from 'react';
import type { NutritionFacts } from '../../services/nutritionService';

interface NutritionFactsCardProps {
  nutrition: NutritionFacts | null;
  loading: boolean;
  /** Highlights this metric as the better value when rendered alongside a comparison card. */
  betterMetrics?: Partial<Record<'calories' | 'sugar' | 'fat' | 'fiber' | 'carbs' | 'protein', boolean>>;
}

const NUTRITION_ROWS: Array<{ key: 'calories' | 'sugar' | 'fat' | 'fiber' | 'carbs' | 'protein'; label: string; unit: string; format: (n: number) => string }> = [
  { key: 'calories', label: 'Calories', unit: 'Cal', format: (n) => String(Math.round(n)) },
  { key: 'sugar', label: 'Sugar', unit: 'g', format: (n) => n.toFixed(1) },
  { key: 'fat', label: 'Fat', unit: 'g', format: (n) => n.toFixed(1) },
  { key: 'fiber', label: 'Fiber', unit: 'g', format: (n) => n.toFixed(1) },
  { key: 'carbs', label: 'Carbs', unit: 'g', format: (n) => n.toFixed(1) },
  { key: 'protein', label: 'Protein', unit: 'g', format: (n) => n.toFixed(1) },
];

export const NutritionFactsCard: React.FC<NutritionFactsCardProps> = ({ nutrition, loading, betterMetrics }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-theme-secondary py-2">
        <div className="w-4 h-4 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
        Loading nutrition info...
      </div>
    );
  }

  if (!nutrition) {
    return <p className="text-sm text-theme-secondary py-2">Nutrition N/A</p>;
  }

  return (
    <div className="space-y-3">
      {/* Serving Size */}
      <div className="bg-theme-secondary rounded-lg p-3">
        <div className="text-xs text-theme-secondary">Serving Size</div>
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-semibold text-theme-primary">{nutrition.servingSize || '100.0'}</div>
          <div className="text-sm text-theme-secondary">g/ml</div>
        </div>
      </div>

      {/* Nutrition grid - 2 columns */}
      <div className="grid grid-cols-2 gap-2">
        {NUTRITION_ROWS.map(({ key, label, unit, format }) => {
          const value = nutrition[key];
          if (value == null) return null;
          const isBetter = betterMetrics?.[key];
          return (
            <div
              key={key}
              className={`bg-theme-secondary rounded-lg p-3 ${isBetter ? 'ring-2 ring-[var(--accent-color)]' : ''}`}
            >
              <div className="text-xs text-theme-secondary">{label}</div>
              <div className="flex items-baseline justify-between">
                <div className={`text-lg font-semibold ${isBetter ? 'text-[var(--accent-color)]' : 'text-theme-primary'}`}>
                  {format(value)}
                </div>
                <div className="text-xs text-theme-secondary">{unit}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-theme-secondary opacity-60 mt-2">
        Source: USDA FoodData Central • Per {nutrition.servingSize}
      </p>
    </div>
  );
};

export default NutritionFactsCard;
