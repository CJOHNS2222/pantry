/**
 * Measurement system utilities for converting between Standard (Imperial) and Metric units
 */

export type MeasurementSystem = 'Standard' | 'Metric';

export interface MeasurementValue {
  amount: number;
  unit: string;
}

/**
 * Convert a measurement from Standard to Metric
 */
export function convertToMetric(amount: number, unit: string): MeasurementValue {
  const lowerUnit = unit.toLowerCase().trim();

  // If already metric, return as-is
  if (['g', 'grams', 'kg', 'kilograms', 'ml', 'milliliters', 'l', 'liters', 'cm', 'centimeters'].includes(lowerUnit)) {
    return { amount, unit };
  }

  // Weight conversion to Metric
  if (['oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'].includes(lowerUnit)) {
    const grams = ['oz', 'ounce', 'ounces'].includes(lowerUnit)
      ? amount * 28.3495
      : amount * 453.592;

    if (grams >= 1000) {
      return { amount: Math.round((grams / 1000) * 100) / 100, unit: 'kg' };
    }
    return { amount: Math.round(grams * 10) / 10, unit: 'g' };
  }

  // Volume conversion to Metric
  if (['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons'].includes(lowerUnit)) {
    let ml = amount;
    if (['cup', 'cups'].includes(lowerUnit)) ml = amount * 236.588;
    else if (['tbsp', 'tablespoon', 'tablespoons'].includes(lowerUnit)) ml = amount * 14.7868;
    else if (['tsp', 'teaspoon', 'teaspoons'].includes(lowerUnit)) ml = amount * 4.92892;
    else if (['fl oz', 'fluid ounce', 'fluid ounces'].includes(lowerUnit)) ml = amount * 29.5735;
    else if (['pint', 'pints'].includes(lowerUnit)) ml = amount * 473.176;
    else if (['quart', 'quarts'].includes(lowerUnit)) ml = amount * 946.353;
    else if (['gallon', 'gallons'].includes(lowerUnit)) ml = amount * 3785.41;

    if (ml >= 1000) {
      return { amount: Math.round((ml / 1000) * 100) / 100, unit: 'l' };
    }
    return { amount: Math.round(ml), unit: 'ml' };
  }

  return { amount, unit };
}

/**
 * Convert a measurement from Metric to Standard
 */
export function convertToStandard(amount: number, unit: string): MeasurementValue {
  const lowerUnit = unit.toLowerCase().trim();

  // If already standard, return as-is
  if (['oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons'].includes(lowerUnit)) {
    return { amount, unit };
  }

  // Weight conversion to Standard
  if (['g', 'grams', 'kg', 'kilograms'].includes(lowerUnit)) {
    let grams = amount;
    if (['kg', 'kilograms'].includes(lowerUnit)) {
      grams = amount * 1000;
    }

    const oz = grams / 28.3495;
    if (oz >= 16) {
      return { amount: Math.round((oz / 16) * 100) / 100, unit: 'lbs' };
    }
    return { amount: Math.round(oz * 10) / 10, unit: 'oz' };
  }

  // Volume conversion to Standard
  if (['ml', 'milliliters', 'l', 'liters'].includes(lowerUnit)) {
    let ml = amount;
    if (['l', 'liters'].includes(lowerUnit)) {
      ml = amount * 1000;
    }

    if (ml < 5) {
      return { amount: Math.round((ml / 4.92892) * 10) / 10, unit: 'tsp' };
    }
    if (ml < 15) {
      return { amount: Math.round((ml / 4.92892) * 10) / 10, unit: 'tsp' };
    }
    if (ml < 35) {
      return { amount: Math.round((ml / 14.7868) * 10) / 10, unit: 'tbsp' };
    }
    if (ml < 118) {
      return { amount: Math.round((ml / 29.5735) * 10) / 10, unit: 'fl oz' };
    }
    
    return { amount: Math.round((ml / 236.588) * 100) / 100, unit: 'cups' };
  }

  return { amount, unit };
}

/**
 * Format a measurement value according to the user's preferred system
 */
export function formatMeasurement(
  amount: number,
  unit: string,
  system: MeasurementSystem,
  originalSystem: MeasurementSystem = 'Standard'
): string {
  if (system === originalSystem) {
    return `${amount} ${unit}`;
  }

  const converted = system === 'Metric'
    ? convertToMetric(amount, unit)
    : convertToStandard(amount, unit);

  return `${converted.amount} ${converted.unit}`;
}

/**
 * Get the user's preferred measurement system from their profile
 */
export function getUserMeasurementSystem(userProfile?: { measurementSystem?: MeasurementSystem }): MeasurementSystem {
  return userProfile?.measurementSystem || 'Standard';
}

/**
 * Convert recipe ingredients based on user's measurement preference
 */
export function convertRecipeIngredients(
  ingredients: Array<{ amount?: number; unit?: string; originalAmount?: number; originalUnit?: string }>,
  targetSystem: MeasurementSystem
): Array<{ amount?: number; unit?: string; originalAmount?: number; originalUnit?: string }> {
  return ingredients.map(ingredient => {
    if (!ingredient.amount || !ingredient.unit) {
      return ingredient;
    }

    const converted = targetSystem === 'Metric'
      ? convertToMetric(ingredient.amount, ingredient.unit)
      : convertToStandard(ingredient.amount, ingredient.unit);

    return {
      ...ingredient,
      amount: converted.amount,
      unit: converted.unit,
      originalAmount: ingredient.amount,
      originalUnit: ingredient.unit
    };
  });
}

/**
 * Convert an amount from one unit to another
 */
export function convertUnit(amount: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();

  if (from === to) return amount;

  // Weight conversion factors to Grams (g)
  const weightFactors: Record<string, number> = {
    'g': 1,
    'grams': 1,
    'kg': 1000,
    'kilograms': 1000,
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592
  };

  // Volume conversion factors to Milliliters (ml)
  const volumeFactors: Record<string, number> = {
    'ml': 1,
    'milliliters': 1,
    'l': 1000,
    'liters': 1000,
    'cup': 236.588,
    'cups': 236.588,
    'tbsp': 14.7868,
    'tablespoon': 14.7868,
    'tablespoons': 14.7868,
    'tsp': 4.92892,
    'teaspoon': 4.92892,
    'teaspoons': 4.92892,
    'fl oz': 29.5735,
    'fluid ounce': 29.5735,
    'fluid ounces': 29.5735,
    'pint': 473.176,
    'pints': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'gallon': 3785.41,
    'gallons': 3785.41
  };

  // 1. Weight to Weight
  if (weightFactors[from] !== undefined && weightFactors[to] !== undefined) {
    const inGrams = amount * weightFactors[from];
    const rawResult = inGrams / weightFactors[to];
    return rawResult < 0.1 ? Math.round(rawResult * 1000) / 1000 : Math.round(rawResult * 100) / 100;
  }

  // 2. Volume to Volume
  if (volumeFactors[from] !== undefined && volumeFactors[to] !== undefined) {
    const inMl = amount * volumeFactors[from];
    const rawResult = inMl / volumeFactors[to];
    return rawResult < 0.1 ? Math.round(rawResult * 1000) / 1000 : Math.round(rawResult * 100) / 100;
  }

  return amount;
}

/**
 * Format scaled quantity to look nice (avoid very small decimals)
 */
export function formatScaledQuantity(quantity: number): string {
  const rounded = Math.round(quantity * 100) / 100;

  if (rounded % 1 === 0) {
    return rounded.toString();
  }

  if (Math.abs(rounded - 0.25) < 0.01) return '1/4';
  if (Math.abs(rounded - 0.33) < 0.01) return '1/3';
  if (Math.abs(rounded - 0.5) < 0.01) return '1/2';
  if (Math.abs(rounded - 0.67) < 0.01) return '2/3';
  if (Math.abs(rounded - 0.75) < 0.01) return '3/4';
  if (Math.abs(rounded - 1.25) < 0.01) return '1 1/4';
  if (Math.abs(rounded - 1.5) < 0.01) return '1 1/2';
  if (Math.abs(rounded - 1.75) < 0.01) return '1 3/4';
  if (Math.abs(rounded - 2.25) < 0.01) return '2 1/4';
  if (Math.abs(rounded - 2.5) < 0.01) return '2 1/2';
  if (Math.abs(rounded - 2.75) < 0.01) return '2 3/4';

  return rounded.toString();
}

/**
 * Parses, converts, and formats a raw ingredient string to the target measurement system.
 */
export function convertIngredientString(ingredient: string, targetSystem: MeasurementSystem): string {
  let text = ingredient.trim()
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/⅛/g, '1/8')
    .replace(/⅜/g, '3/8')
    .replace(/⅝/g, '5/8')
    .replace(/⅞/g, '7/8');

  // Handle mixed fractions written as two separate tokens, e.g. "1 1/2 tsp"
  text = text.replace(/^(\d+)\s+(\d+\/\d+)(\s|$)/, (_, whole, frac, rest) => {
    const [num, den] = frac.split('/').map(Number);
    const value = parseInt(whole) + num / den;
    return value + (rest || ' ');
  });

  const words = text.split(/\s+/);
  if (words.length === 0) return ingredient;

  const firstWord = words[0]!;
  
  // Try to match a number at the start of first word (e.g. "460", "2.5", "1/2")
  const numberPattern = /^(\d+(?:\/\d+|\.\d+)?)(.*)$/;
  const numMatch = firstWord.match(numberPattern);
  if (!numMatch) return ingredient;

  const numStr = numMatch[1]!;
  let unitPart = numMatch[2]! || '';

  let amount = parseFloat(numStr);
  if (numStr.includes('/')) {
    const [num, den] = numStr.split('/').map(Number);
    amount = num / den;
  }

  if (isNaN(amount) || amount <= 0) return ingredient;

  let restWordsStartIndex = 1;

  // If unitPart is empty, check if the second word is a unit
  if (!unitPart && words.length > 1) {
    const secondWord = words[1]!.toLowerCase().replace(/[^a-z]/g, '');
    const knownUnits = [
      'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
      'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
      'cup', 'cups', 'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
      'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
      'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons'
    ];
    if (knownUnits.includes(secondWord)) {
      unitPart = words[1]!;
      restWordsStartIndex = 2;
    }
  }

  const cleanUnit = unitPart.toLowerCase().replace(/[^a-z]/g, '').trim();
  const weightUnits = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'];
  const volumeUnits = ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'fl oz', 'fluid ounce', 'fluid ounces', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons'];

  if (!weightUnits.includes(cleanUnit) && !volumeUnits.includes(cleanUnit)) {
    return ingredient;
  }

  const converted = targetSystem === 'Metric'
    ? convertToMetric(amount, cleanUnit)
    : convertToStandard(amount, cleanUnit);

  const formattedAmount = targetSystem === 'Standard'
    ? formatScaledQuantity(converted.amount)
    : converted.amount.toString();

  const restString = words.slice(restWordsStartIndex).join(' ');
  const separator = restString ? ' ' : '';
  
  return `${formattedAmount} ${converted.unit}${separator}${restString}`;
}