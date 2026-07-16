/**
 * Measurement system utilities for converting between Standard (Imperial) and Metric units
 */

export type MeasurementSystem = 'Standard' | 'Metric';

export interface MeasurementValue {
  amount: number;
  unit: string;
}

/**
 * Common measurement conversions
 */
const CONVERSIONS = {
  // Volume
  'cup': { toMetric: { amount: 236.588, unit: 'ml' } },
  'cups': { toMetric: { amount: 236.588, unit: 'ml' } },
  'tbsp': { toMetric: { amount: 14.7868, unit: 'ml' } },
  'tsp': { toMetric: { amount: 4.92892, unit: 'ml' } },
  'fl oz': { toMetric: { amount: 29.5735, unit: 'ml' } },
  'pint': { toMetric: { amount: 473.176, unit: 'ml' } },
  'quart': { toMetric: { amount: 946.353, unit: 'ml' } },
  'gallon': { toMetric: { amount: 3785.41, unit: 'ml' } },

  // Weight
  'oz': { toMetric: { amount: 28.3495, unit: 'g' } },
  'lb': { toMetric: { amount: 453.592, unit: 'g' } },
  'lbs': { toMetric: { amount: 453.592, unit: 'g' } },

  // Length (for cooking measurements)
  'inch': { toMetric: { amount: 2.54, unit: 'cm' } },
  'inches': { toMetric: { amount: 2.54, unit: 'cm' } },
} as const;

/**
 * Convert a measurement from Standard to Metric
 */
export function convertToMetric(amount: number, unit: string): MeasurementValue {
  const lowerUnit = unit.toLowerCase();
  const conversion = CONVERSIONS[lowerUnit as keyof typeof CONVERSIONS];

  if (conversion) {
    return {
      amount: Math.round((amount * conversion.toMetric.amount) * 100) / 100,
      unit: conversion.toMetric.unit
    };
  }

  // If no conversion available, return as-is
  return { amount, unit };
}

/**
 * Convert a measurement from Metric to Standard
 */
export function convertToStandard(amount: number, unit: string): MeasurementValue {
  const lowerUnit = unit.toLowerCase();

  // Find the reverse conversion
  for (const [standardUnit, conversion] of Object.entries(CONVERSIONS)) {
    if (conversion.toMetric.unit === lowerUnit) {
      return {
        amount: Math.round((amount / conversion.toMetric.amount) * 100) / 100,
        unit: standardUnit
      };
    }
  }

  // If no conversion available, return as-is
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