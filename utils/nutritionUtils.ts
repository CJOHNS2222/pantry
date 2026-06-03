/**
 * User profile and nutrition calculation utilities
 * Provides functions for calculating BMR, TDEE, macro targets, and personalized nutrition recommendations
 */

export interface MacroTargets {
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
}

import { UserProfile } from '../types';

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export function calculateBMR(profile: UserProfile): number | null {
  if (!profile.height || !profile.weight || !profile.age || !profile.gender) {
    return null;
  }

  const { height, weight, age, gender } = profile;

  if (gender === 'male') {
    // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
    const weightKg = weight * 0.453592; // Convert lbs to kg
    const heightCm = height * 2.54; // Convert inches to cm
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else if (gender === 'female') {
    // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
    const weightKg = weight * 0.453592;
    const heightCm = height * 2.54;
    return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  return null;
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE) based on BMR and activity level
 */
export function calculateTDEE(bmr: number, activityLevel?: string): number {
  const activityMultipliers = {
    'sedentary': 1.2, // Little or no exercise
    'lightly-active': 1.375, // Light exercise 1-3 days/week
    'moderately-active': 1.55, // Moderate exercise 3-5 days/week
    'very-active': 1.725, // Hard exercise 6-7 days/week
    'extremely-active': 1.9 // Very hard exercise & physical job
  };

  const multiplier = activityMultipliers[activityLevel as keyof typeof activityMultipliers] || 1.2;
  return bmr * multiplier;
}

/**
 * Calculate macro targets based on TDEE and diet goal
 */
export function calculateMacroTargets(tdee: number, dietGoal?: string): MacroTargets {
  let targetCalories = tdee;

  // Adjust calories based on goal
  switch (dietGoal) {
    case 'lose-weight':
      targetCalories = tdee - 500; // 500 calorie deficit for ~1lb/week loss
      break;
    case 'gain-weight':
    case 'build-muscle':
      targetCalories = tdee + 300; // 300 calorie surplus for gradual gain
      break;
    case 'maintain-weight':
    case 'improve-health':
    default:
      // Keep TDEE as is
      break;
  }

  // Ensure reasonable calorie bounds
  targetCalories = Math.max(1200, Math.min(4000, targetCalories));

  // Calculate macros based on goal
  let proteinRatio: number, carbRatio: number, fatRatio: number;

  switch (dietGoal) {
    case 'build-muscle':
      // Higher protein for muscle building
      proteinRatio = 0.30; // 30% protein
      carbRatio = 0.45; // 45% carbs
      fatRatio = 0.25; // 25% fat
      break;
    case 'lose-weight':
      // Moderate protein, controlled carbs
      proteinRatio = 0.35; // 35% protein
      carbRatio = 0.35; // 35% carbs
      fatRatio = 0.30; // 30% fat
      break;
    case 'improve-health':
      // Balanced approach
      proteinRatio = 0.25; // 25% protein
      carbRatio = 0.50; // 50% carbs
      fatRatio = 0.25; // 25% fat
      break;
    default:
      // Default balanced macros
      proteinRatio = 0.25; // 25% protein
      carbRatio = 0.50; // 50% carbs
      fatRatio = 0.25; // 25% fat
  }

  return {
    calories: Math.round(targetCalories),
    protein: Math.round((targetCalories * proteinRatio) / 4), // 4 calories per gram of protein
    carbs: Math.round((targetCalories * carbRatio) / 4), // 4 calories per gram of carbs
    fat: Math.round((targetCalories * fatRatio) / 9) // 9 calories per gram of fat
  };
}

/**
 * Get personalized nutrition targets for a user
 */
export function getUserNutritionTargets(profile: UserProfile): MacroTargets | null {
  const bmr = calculateBMR(profile);
  if (!bmr) return null;

  const tdee = calculateTDEE(bmr, profile.activityLevel);
  return calculateMacroTargets(tdee, profile.dietGoal);
}

/**
 * Check if a recipe fits within user's macro targets
 */
export function checkRecipeMacros(
  recipe: { calories?: number; protein?: number; carbs?: number; fat?: number },
  userTargets: MacroTargets,
  tolerancePercent: number = 0.2 // 20% tolerance
): {
  fits: boolean;
  deviations: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
} {
  const deviations = {
    calories: recipe.calories ? ((recipe.calories - userTargets.calories) / userTargets.calories) : 0,
    protein: recipe.protein ? ((recipe.protein - userTargets.protein) / userTargets.protein) : 0,
    carbs: recipe.carbs ? ((recipe.carbs - userTargets.carbs) / userTargets.carbs) : 0,
    fat: recipe.fat ? ((recipe.fat - userTargets.fat) / userTargets.fat) : 0
  };

  const fits = Object.values(deviations).every(deviation =>
    Math.abs(deviation) <= tolerancePercent
  );

  return { fits, deviations };
}

/**
 * Generate personalized recipe search prompt based on user profile
 */
export function generatePersonalizedSearchPrompt(
  basePrompt: string,
  userProfile: UserProfile,
  macroTargets?: MacroTargets
): string {
  let personalizedPrompt = basePrompt;

  if (macroTargets) {
    personalizedPrompt += ` Target nutrition: ~${macroTargets.calories} calories, ${macroTargets.protein}g protein, ${macroTargets.carbs}g carbs, ${macroTargets.fat}g fat.`;
  }

  if (userProfile.dietGoal) {
    const goalDescriptions = {
      'lose-weight': 'focus on lower-calorie, nutrient-dense ingredients',
      'maintain-weight': 'balance calories and nutrients appropriately',
      'gain-weight': 'include calorie-dense, nutritious ingredients',
      'build-muscle': 'emphasize high-protein ingredients and complete meals',
      'improve-health': 'prioritize whole foods, vegetables, and balanced nutrition'
    };

    const goalDesc = goalDescriptions[userProfile.dietGoal as keyof typeof goalDescriptions];
    if (goalDesc) {
      personalizedPrompt += ` Goal: ${goalDesc}.`;
    }
  }

  if (userProfile.favoriteCuisines?.length) {
    personalizedPrompt += ` Preferred cuisines: ${userProfile.favoriteCuisines.join(', ')}.`;
  }

  if (userProfile.preferredProteins?.length) {
    personalizedPrompt += ` Preferred proteins: ${userProfile.preferredProteins.join(', ')}.`;
  }

  return personalizedPrompt;
}