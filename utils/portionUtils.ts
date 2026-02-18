import { StructuredRecipe, SavedRecipe, Household } from '../types';

// Portion scaling configuration
export interface PortionConfig {
  householdSize: number;
  baseServingSize: number; // Usually 4 servings for most recipes
  scalingFactor: number;
}

// Default portion configurations
export const PORTION_PRESETS = {
  single: { householdSize: 1, baseServingSize: 4, scalingFactor: 0.25 },
  couple: { householdSize: 2, baseServingSize: 4, scalingFactor: 0.5 },
  smallFamily: { householdSize: 4, baseServingSize: 4, scalingFactor: 1.0 },
  largeFamily: { householdSize: 6, baseServingSize: 4, scalingFactor: 1.5 },
  extendedFamily: { householdSize: 8, baseServingSize: 4, scalingFactor: 2.0 }
};

// Calculate portion scaling factor based on household size
export const calculatePortionScaling = (
  household: Household | null,
  targetServings: number = 4
): PortionConfig => {
  const householdSize = household?.members?.length || 1;

  // Find the best preset match
  let bestPreset = PORTION_PRESETS.smallFamily; // Default to 4 people
  let minDifference = Math.abs(householdSize - PORTION_PRESETS.smallFamily.householdSize);

  for (const [key, preset] of Object.entries(PORTION_PRESETS)) {
    const difference = Math.abs(householdSize - preset.householdSize);
    if (difference < minDifference) {
      minDifference = difference;
      bestPreset = preset;
    }
  }

  return {
    householdSize,
    baseServingSize: targetServings,
    scalingFactor: bestPreset.scalingFactor
  };
};

// Scale recipe ingredients based on portion configuration
/**
 * Scales recipe ingredients based on household size and portion configuration
 * @param recipe The recipe to scale
 * @param portionConfig The portion configuration with scaling factor
 * @returns Array of scaled ingredient strings
 */
export const scaleRecipeIngredients = (
  recipe: StructuredRecipe | SavedRecipe,
  portionConfig: PortionConfig
): string[] => {
  return recipe.ingredients.map(ingredient => {
    const scaledIngredient = scaleIngredient(ingredient, portionConfig.scalingFactor);
    return scaledIngredient;
  });
};

// Scale a single ingredient string
export const scaleIngredient = (ingredient: string, scalingFactor: number): string => {
  // Parse ingredient to extract quantity
  const quantityMatch = ingredient.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(.+)$/);

  if (quantityMatch) {
    const [, qtyStr, rest] = quantityMatch;
    const quantity = parseFloat(qtyStr);

    if (!isNaN(quantity)) {
      const scaledQuantity = quantity * scalingFactor;

      // Format the scaled quantity nicely
      const formattedQuantity = formatScaledQuantity(scaledQuantity);

      return `${formattedQuantity} ${rest}`;
    }
  }

  // If no quantity found, return as-is (some ingredients like "salt to taste")
  return ingredient;
};

// Format scaled quantity to look nice (avoid very small decimals)
const formatScaledQuantity = (quantity: number): string => {
  // Round to 2 decimal places
  const rounded = Math.round(quantity * 100) / 100;

  // If it's a whole number, return as integer
  if (rounded % 1 === 0) {
    return rounded.toString();
  }

  // If it's a common fraction, format nicely
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

  // Otherwise return as decimal
  return rounded.toString();
};

// Get recommended serving size based on household
/**
 * Calculates recommended serving size based on household member count
 * @param household The household object with members array
 * @returns Recommended number of servings for the household size
 */
export const getRecommendedServings = (household: Household | null): number => {
  const householdSize = household?.members?.length || 1;

  if (householdSize <= 1) return 2; // Single person
  if (householdSize <= 2) return 2; // Couple
  if (householdSize <= 4) return 4; // Small family
  if (householdSize <= 6) return 6; // Large family
  return 8; // Extended family
};

// Create scaled recipe with updated servings and ingredients
export const createScaledRecipe = (
  originalRecipe: StructuredRecipe | SavedRecipe,
  portionConfig: PortionConfig
): StructuredRecipe | SavedRecipe => {
  const scaledIngredients = scaleRecipeIngredients(originalRecipe, portionConfig);
  const newServings = Math.round(originalRecipe.servings * portionConfig.scalingFactor);

  return {
    ...originalRecipe,
    ingredients: scaledIngredients,
    servings: newServings,
    // Add metadata about scaling
    _scaledFrom: originalRecipe.servings,
    _scalingFactor: portionConfig.scalingFactor,
    _householdSize: portionConfig.householdSize
  };
};
