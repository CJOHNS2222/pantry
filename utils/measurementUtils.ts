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