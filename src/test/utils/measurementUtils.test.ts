import { describe, it, expect } from 'vitest';
import {
  convertToMetric,
  convertToStandard,
  formatMeasurement,
  getUserMeasurementSystem,
  convertRecipeIngredients,
  convertUnit,
  formatScaledQuantity,
  convertIngredientString
} from '../../../utils/measurementUtils';

describe('measurementUtils', () => {
  describe('convertToMetric', () => {
    it('returns metric inputs unmodified', () => {
      expect(convertToMetric(100, 'g')).toEqual({ amount: 100, unit: 'g' });
      expect(convertToMetric(500, 'ml')).toEqual({ amount: 500, unit: 'ml' });
    });

    it('converts weight units to grams or kilograms', () => {
      // 1 oz = ~28.35 g
      expect(convertToMetric(1, 'oz')).toEqual({ amount: 28.3, unit: 'g' });
      // 2 lbs = 907.2 g
      expect(convertToMetric(2, 'lbs')).toEqual({ amount: 907.2, unit: 'g' });
      // 5 lbs = 2268 g -> 2.27 kg
      expect(convertToMetric(5, 'lbs')).toEqual({ amount: 2.27, unit: 'kg' });
    });

    it('converts volume units to ml or l', () => {
      // 1 cup = 236.588 ml -> 237 ml
      expect(convertToMetric(1, 'cup')).toEqual({ amount: 237, unit: 'ml' });
      // 1 tbsp = ~15 ml
      expect(convertToMetric(1, 'tbsp')).toEqual({ amount: 15, unit: 'ml' });
      // 1 gallon = 3785 ml -> 3.79 l
      expect(convertToMetric(1, 'gallon')).toEqual({ amount: 3.79, unit: 'l' });
    });
  });

  describe('convertToStandard', () => {
    it('returns standard inputs unmodified', () => {
      expect(convertToStandard(1, 'cup')).toEqual({ amount: 1, unit: 'cup' });
      expect(convertToStandard(16, 'oz')).toEqual({ amount: 16, unit: 'oz' });
    });

    it('converts grams and kilograms to oz or lbs', () => {
      // 100 g -> ~3.5 oz
      expect(convertToStandard(100, 'g')).toEqual({ amount: 3.5, unit: 'oz' });
      // 1 kg -> 1000 g -> ~35.27 oz -> ~2.2 lbs
      expect(convertToStandard(1, 'kg')).toEqual({ amount: 2.2, unit: 'lbs' });
    });

    it('converts milliliters and liters to standard volume units', () => {
      // 250 ml -> ~1.06 cups
      expect(convertToStandard(250, 'ml')).toEqual({ amount: 1.06, unit: 'cups' });
      // 5 ml -> ~1 tsp
      expect(convertToStandard(5, 'ml')).toEqual({ amount: 1, unit: 'tsp' });
    });
  });

  describe('formatMeasurement & getUserMeasurementSystem', () => {
    it('returns default system Standard if user profile missing', () => {
      expect(getUserMeasurementSystem(undefined)).toBe('Standard');
      expect(getUserMeasurementSystem({ measurementSystem: 'Metric' })).toBe('Metric');
    });

    it('formats measurement without converting if target equals original system', () => {
      expect(formatMeasurement(2, 'cups', 'Standard', 'Standard')).toBe('2 cups');
    });

    it('formats converted measurement when systems differ', () => {
      const formatted = formatMeasurement(1, 'cup', 'Metric', 'Standard');
      expect(formatted).toBe('237 ml');
    });
  });

  describe('convertUnit', () => {
    it('returns same amount when from and to units are identical', () => {
      expect(convertUnit(5, 'cups', 'cups')).toBe(5);
    });

    it('converts weight units correctly', () => {
      // 1 kg to g
      expect(convertUnit(1, 'kg', 'g')).toBe(1000);
      // 1 lb to oz
      expect(convertUnit(1, 'lb', 'oz')).toBe(16);
    });

    it('converts volume units correctly', () => {
      // 1 liter to ml
      expect(convertUnit(1, 'l', 'ml')).toBe(1000);
      // 3 tsp to tbsp
      expect(convertUnit(3, 'tsp', 'tbsp')).toBe(1);
    });
  });

  describe('formatScaledQuantity', () => {
    it('formats whole numbers without decimals', () => {
      expect(formatScaledQuantity(3.0)).toBe('3');
      expect(formatScaledQuantity(0.0)).toBe('0');
    });

    it('formats common fractions nicely', () => {
      expect(formatScaledQuantity(0.25)).toBe('1/4');
      expect(formatScaledQuantity(0.33)).toBe('1/3');
      expect(formatScaledQuantity(0.5)).toBe('1/2');
      expect(formatScaledQuantity(0.75)).toBe('3/4');
      expect(formatScaledQuantity(1.5)).toBe('1 1/2');
      expect(formatScaledQuantity(2.25)).toBe('2 1/4');
    });

    it('returns raw rounded string for non-standard decimals', () => {
      expect(formatScaledQuantity(1.123)).toBe('1.12');
    });
  });

  describe('convertIngredientString', () => {
    it('converts ingredient with unicode fraction', () => {
      // ½ cup milk -> Metric: 118 ml milk
      const converted = convertIngredientString('½ cup milk', 'Metric');
      expect(converted).toBe('118 ml milk');
    });

    it('converts mixed fractions', () => {
      // 1 1/2 tsp salt -> Metric: 7 ml salt
      const converted = convertIngredientString('1 1/2 tsp salt', 'Metric');
      expect(converted).toBe('7 ml salt');
    });

    it('returns non-quantitative or unrecognized ingredient strings untouched', () => {
      expect(convertIngredientString('salt to taste', 'Metric')).toBe('salt to taste');
      expect(convertIngredientString('pinch of nutmeg', 'Metric')).toBe('pinch of nutmeg');
    });

    it('converts metric ingredient string back to standard', () => {
      const converted = convertIngredientString('250 ml water', 'Standard');
      expect(converted).toBe('1.06 cups water');
    });
  });

  describe('convertRecipeIngredients', () => {
    it('converts array of structured ingredient objects', () => {
      const ingredients = [
        { amount: 1, unit: 'cup', name: 'flour' },
        { amount: 100, unit: 'g', name: 'sugar' }
      ];

      const converted = convertRecipeIngredients(ingredients, 'Metric');
      expect(converted[0]?.amount).toBe(237);
      expect(converted[0]?.unit).toBe('ml');
      expect(converted[0]?.originalAmount).toBe(1);
    });
  });
});
