import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTDEE,
  calculateMacroTargets,
  getUserNutritionTargets,
  checkRecipeMacros,
  generatePersonalizedSearchPrompt
} from '../../../utils/nutritionUtils';
import { UserProfile } from '../../types';

describe('Nutrition Utils', () => {
  describe('calculateBMR', () => {
    it('should calculate BMR for male', () => {
      const profile: UserProfile = {
        height: 70, // 70 inches
        weight: 170, // 170 pounds
        age: 30,
        gender: 'male'
      };

      const bmr = calculateBMR(profile);
      expect(bmr).toBeGreaterThan(1600);
      expect(bmr).toBeLessThan(2000);
    });

    it('should calculate BMR for female', () => {
      const profile: UserProfile = {
        height: 65, // 65 inches
        weight: 140, // 140 pounds
        age: 25,
        gender: 'female'
      };

      const bmr = calculateBMR(profile);
      expect(bmr).toBeGreaterThan(1300);
      expect(bmr).toBeLessThan(1500);
    });

    it('should return null for incomplete profile', () => {
      const profile: UserProfile = {
        height: 70,
        weight: 170
        // missing age and gender
      };

      const bmr = calculateBMR(profile);
      expect(bmr).toBeNull();
    });
  });

  describe('calculateTDEE', () => {
    it('should calculate TDEE with activity level', () => {
      const bmr = 1800;
      const tdee = calculateTDEE(bmr, 'moderately-active');
      expect(tdee).toBe(bmr * 1.55);
    });

    it('should use sedentary multiplier by default', () => {
      const bmr = 1800;
      const tdee = calculateTDEE(bmr);
      expect(tdee).toBe(bmr * 1.2);
    });
  });

  describe('calculateMacroTargets', () => {
    it('should calculate macros for weight loss', () => {
      const tdee = 2200;
      const targets = calculateMacroTargets(tdee, 'lose-weight');

      expect(targets.calories).toBe(1700); // tdee - 500
      expect(targets.protein).toBeGreaterThan(100); // higher protein for weight loss
      expect(targets.carbs).toBeGreaterThan(140); // ~35% of calories for weight loss
      expect(targets.fat).toBeGreaterThan(50);
    });

    it('should calculate macros for muscle building', () => {
      const tdee = 2200;
      const targets = calculateMacroTargets(tdee, 'build-muscle');

      expect(targets.calories).toBe(2500); // tdee + 300
      expect(targets.protein).toBeGreaterThan(150); // high protein
    });
  });

  describe('getUserNutritionTargets', () => {
    it('should return macro targets for complete profile', () => {
      const profile: UserProfile = {
        height: 70,
        weight: 170,
        age: 30,
        gender: 'male',
        activityLevel: 'moderately-active',
        dietGoal: 'maintain-weight'
      };

      const targets = getUserNutritionTargets(profile);
      expect(targets).toBeTruthy();
      expect(targets?.calories).toBeGreaterThan(2000);
      expect(targets?.protein).toBeGreaterThan(50);
    });

    it('should return null for incomplete profile', () => {
      const profile: UserProfile = {
        dietGoal: 'maintain-weight'
        // missing physical attributes
      };

      const targets = getUserNutritionTargets(profile);
      expect(targets).toBeNull();
    });
  });

  describe('checkRecipeMacros', () => {
    it('should check if recipe fits macro targets', () => {
      const recipe = {
        calories: 500,
        protein: 30,
        carbs: 40,
        fat: 20
      };

      const targets = {
        calories: 500,
        protein: 30,
        carbs: 40,
        fat: 20
      };

      const result = checkRecipeMacros(recipe, targets);
      expect(result.fits).toBe(true);
      expect(result.deviations.calories).toBe(0);
    });

    it('should detect macro deviations', () => {
      const recipe = {
        calories: 600,
        protein: 20,
        carbs: 50,
        fat: 25
      };

      const targets = {
        calories: 500,
        protein: 30,
        carbs: 40,
        fat: 20
      };

      const result = checkRecipeMacros(recipe, targets);
      expect(result.fits).toBe(false);
      expect(result.deviations.calories).toBe(0.2); // 20% over
      expect(result.deviations.protein).toBeLessThan(0); // under
    });
  });

  describe('generatePersonalizedSearchPrompt', () => {
    it('should include macro targets in prompt', () => {
      const basePrompt = "Generate recipes";
      const profile: UserProfile = {
        dietGoal: 'lose-weight',
        favoriteCuisines: ['Italian', 'Mexican']
      };

      const macroTargets = {
        calories: 1800,
        protein: 135,
        carbs: 180,
        fat: 60
      };

      const prompt = generatePersonalizedSearchPrompt(basePrompt, profile, macroTargets);
      expect(prompt).toContain('1800 calories');
      expect(prompt).toContain('135g protein');
      expect(prompt).toContain('lower-calorie, nutrient-dense ingredients');
      expect(prompt).toContain('Italian');
      expect(prompt).toContain('Mexican');
    });
  });
});