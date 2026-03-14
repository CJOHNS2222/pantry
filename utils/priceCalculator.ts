/**
 * Price calculation utilities for shopping list price-per-unit comparisons
 */

export interface PriceOption {
  amount: number;
  unit: string;
  price: number;
  store?: string;
}

export interface PriceComparison {
  pricePerUnit: number;
  unit: string;
  isBestValue: boolean;
  savings?: number;
  savingsPercent?: number;
}

/**
 * Calculate price per unit for a given price option
 */
export function calculatePricePerUnit(option: PriceOption): number {
  if (option.amount <= 0 || option.price <= 0) return Infinity;
  return option.price / option.amount;
}

/**
 * Normalize units for comparison (convert to common base units)
 */
export function normalizeUnit(amount: number, unit: string): { amount: number; unit: string } {
  const lowerUnit = unit.toLowerCase();

  // Weight conversions to grams
  if (lowerUnit.includes('kg')) {
    return { amount: amount * 1000, unit: 'g' };
  }
  if (lowerUnit.includes('lb') || lowerUnit.includes('lbs')) {
    return { amount: amount * 453.592, unit: 'g' };
  }
  if (lowerUnit.includes('oz')) {
    return { amount: amount * 28.3495, unit: 'g' };
  }

  // Volume conversions to milliliters
  if (lowerUnit.includes('l') || lowerUnit.includes('liter')) {
    return { amount: amount * 1000, unit: 'ml' };
  }
  if (lowerUnit.includes('gal')) {
    return { amount: amount * 3785.41, unit: 'ml' };
  }
  if (lowerUnit.includes('qt')) {
    return { amount: amount * 946.353, unit: 'ml' };
  }
  if (lowerUnit.includes('pt')) {
    return { amount: amount * 473.176, unit: 'ml' };
  }
  if (lowerUnit.includes('cup')) {
    return { amount: amount * 236.588, unit: 'ml' };
  }
  if (lowerUnit.includes('fl oz') || lowerUnit.includes('fluid oz')) {
    return { amount: amount * 29.5735, unit: 'ml' };
  }
  if (lowerUnit.includes('tbsp') || lowerUnit.includes('tablespoon')) {
    return { amount: amount * 14.7868, unit: 'ml' };
  }
  if (lowerUnit.includes('tsp') || lowerUnit.includes('teaspoon')) {
    return { amount: amount * 4.92892, unit: 'ml' };
  }

  // Return as-is if no conversion available
  return { amount, unit };
}

/**
 * Compare multiple price options and return comparison data
 */
export function comparePriceOptions(options: PriceOption[]): PriceComparison[] {
  if (options.length === 0) return [];

  // Normalize all units to comparable base units
  const normalizedOptions = options.map(option => ({
    ...option,
    normalized: normalizeUnit(option.amount, option.unit)
  }));

  // Calculate price per unit for each option
  const withPricePerUnit = normalizedOptions.map(option => ({
    ...option,
    pricePerUnit: calculatePricePerUnit(option)
  }));

  // Find the best (lowest) price per unit
  const bestPricePerUnit = Math.min(...withPricePerUnit.map(opt => opt.pricePerUnit));

  // Calculate savings for each option
  return withPricePerUnit.map(option => {
    const isBestValue = option.pricePerUnit === bestPricePerUnit;
    const savings = isBestValue ? 0 : option.price - (option.amount * bestPricePerUnit);
    const savingsPercent = isBestValue ? 0 : ((savings / option.price) * 100);

    return {
      pricePerUnit: option.pricePerUnit,
      unit: option.normalized.unit,
      isBestValue,
      savings: savings > 0 ? savings : undefined,
      savingsPercent: savingsPercent > 0 ? savingsPercent : undefined
    };
  });
}

/**
 * Format price per unit for display
 */
export function formatPricePerUnit(pricePerUnit: number, unit: string): string {
  const formattedPrice = pricePerUnit.toFixed(2);
  return `$${formattedPrice}/${unit}`;
}

/**
 * Get a human-readable comparison summary
 */
export function getPriceComparisonSummary(options: PriceOption[]): string {
  if (options.length < 2) return '';

  const comparisons = comparePriceOptions(options);
  const bestOption = comparisons.find(c => c.isBestValue);

  if (!bestOption) return '';

  const savings = comparisons
    .filter(c => !c.isBestValue && c.savings && c.savings > 0)
    .map(c => c.savings!)
    .reduce((sum, saving) => sum + saving, 0);

  if (savings > 0) {
    return `Save $${savings.toFixed(2)} with best value option`;
  }

  return 'Compare prices to find the best value';
}