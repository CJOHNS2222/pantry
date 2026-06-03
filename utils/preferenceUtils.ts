import { Member, StructuredRecipe, PantryItem, SavedRecipe, UserProfile } from '../types';
import { getUserNutritionTargets, checkRecipeMacros } from './nutritionUtils';

/**
 * Utility functions for checking household member preferences against recipes and inventory
 */

export interface PreferenceCheckResult {
  isSafe: boolean;
  violations: {
    allergies: string[];
    restrictions: string[];
    dislikes: string[];
  };
  warnings: string[];
}

/**
 * Common allergen mappings for better matching
 */
const ALLERGEN_MAPPINGS: Record<string, string[]> = {
  'nuts': ['peanuts', 'almonds', 'walnuts', 'cashews', 'pistachios', 'hazelnuts', 'pecans', 'macadamia', 'brazil nuts'],
  'peanuts': ['nuts', 'peanut butter', 'peanut oil'],
  'tree nuts': ['almonds', 'walnuts', 'cashews', 'pistachios', 'hazelnuts', 'pecans', 'macadamia', 'brazil nuts'],
  'dairy': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'ice cream', 'sour cream'],
  'milk': ['dairy', 'lactose', 'casein'],
  'eggs': ['egg', 'egg whites', 'egg yolks'],
  'fish': ['salmon', 'tuna', 'cod', 'halibut', 'swordfish', 'seafood'],
  'shellfish': ['shrimp', 'crab', 'lobster', 'clams', 'oysters', 'scallops', 'seafood'],
  'soy': ['tofu', 'soy sauce', 'tempeh', 'edamame', 'soy milk'],
  'wheat': ['flour', 'bread', 'pasta', 'gluten'],
  'gluten': ['wheat', 'barley', 'rye', 'flour', 'bread', 'pasta']
};

/**
 * Dietary restriction mappings
 */
const RESTRICTION_MAPPINGS: Record<string, string[]> = {
  'vegetarian': ['meat', 'chicken', 'beef', 'pork', 'fish', 'lamb', 'turkey', 'bacon', 'sausage'],
  'vegan': ['meat', 'chicken', 'beef', 'pork', 'fish', 'lamb', 'turkey', 'bacon', 'sausage', 'dairy', 'milk', 'cheese', 'butter', 'eggs', 'honey'],
  'gluten-free': ['wheat', 'flour', 'bread', 'pasta', 'gluten'],
  'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'ice cream'],
  'keto': ['sugar', 'bread', 'pasta', 'rice', 'potatoes', 'carbs'],
  'paleo': ['processed foods', 'dairy', 'grains', 'sugar', 'legumes']
};

/**
 * Normalize ingredient name for better matching
 */
function normalizeIngredient(ingredient: string): string {
  return ingredient.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Check if an ingredient matches any allergens for a member
 */
function checkAllergies(ingredient: string, member: Member): string[] {
  if (!member.allergies?.length) return [];

  const normalizedIngredient = normalizeIngredient(ingredient);
  const violations: string[] = [];

  for (const allergy of member.allergies) {
    const normalizedAllergy = normalizeIngredient(allergy);

    // Direct match
    if (normalizedIngredient.includes(normalizedAllergy) ||
        normalizedAllergy.includes(normalizedIngredient)) {
      violations.push(allergy);
      continue;
    }

    // Check allergen mappings
    const relatedAllergens = ALLERGEN_MAPPINGS[normalizedAllergy] || [];
    for (const related of relatedAllergens) {
      if (normalizedIngredient.includes(related) ||
          related.includes(normalizedIngredient)) {
        violations.push(allergy);
        break;
      }
    }
  }

  return [...new Set(violations)]; // Remove duplicates
}

/**
 * Check if an ingredient violates dietary restrictions
 */
function checkRestrictions(ingredient: string, member: Member): string[] {
  if (!member.dietaryRestrictions?.length) return [];

  const normalizedIngredient = normalizeIngredient(ingredient);
  const violations: string[] = [];

  for (const restriction of member.dietaryRestrictions) {
    const normalizedRestriction = normalizeIngredient(restriction);

    // Check restriction mappings
    const restrictedItems = RESTRICTION_MAPPINGS[normalizedRestriction] || [];
    for (const restricted of restrictedItems) {
      if (normalizedIngredient.includes(restricted) ||
          restricted.includes(normalizedIngredient)) {
        violations.push(restriction);
        break;
      }
    }
  }

  return [...new Set(violations)]; // Remove duplicates
}

/**
 * Check if an ingredient is disliked by the member
 */
function checkDislikes(ingredient: string, member: Member): string[] {
  if (!member.dislikedIngredients?.length) return [];

  const normalizedIngredient = normalizeIngredient(ingredient);
  const violations: string[] = [];

  for (const dislike of member.dislikedIngredients) {
    const normalizedDislike = normalizeIngredient(dislike);
    if (normalizedIngredient.includes(normalizedDislike) ||
        normalizedDislike.includes(normalizedIngredient)) {
      violations.push(dislike);
      break;
    }
  }

  return violations;
}

/**
 * Check if a recipe is safe for a household member based on their preferences
 */
export function checkRecipeAgainstPreferences(
  recipe: StructuredRecipe | SavedRecipe,
  member: Member
): PreferenceCheckResult {
  const violations = {
    allergies: [] as string[],
    restrictions: [] as string[],
    dislikes: [] as string[]
  };

  const warnings: string[] = [];

  // Get ingredients from recipe (handle StructuredRecipe | SavedRecipe safely)
  const ingredients: string[] = Array.isArray((recipe as any).ingredients)
    ? (recipe as any).ingredients.map((ing: any) => typeof ing === 'string' ? ing : ing.name || ing.item || '')
    : [];

  // Check each ingredient
  for (const ingredient of ingredients) {
    if (!ingredient) continue;

    // Check allergies (most serious)
    const allergyViolations = checkAllergies(ingredient, member);
    violations.allergies.push(...allergyViolations);

    // Check dietary restrictions
    const restrictionViolations = checkRestrictions(ingredient, member);
    violations.restrictions.push(...restrictionViolations);

    // Check dislikes (least serious)
    const dislikeViolations = checkDislikes(ingredient, member);
    violations.dislikes.push(...dislikeViolations);
  }

  // Remove duplicates
  violations.allergies = [...new Set(violations.allergies)];
  violations.restrictions = [...new Set(violations.restrictions)];
  violations.dislikes = [...new Set(violations.dislikes)];

  // Generate warnings
  if (violations.allergies.length > 0) {
    warnings.push(`Contains allergens: ${violations.allergies.join(', ')}`);
  }
  if (violations.restrictions.length > 0) {
    warnings.push(`Violates dietary restrictions: ${violations.restrictions.join(', ')}`);
  }
  if (violations.dislikes.length > 0) {
    warnings.push(`Contains disliked ingredients: ${violations.dislikes.join(', ')}`);
  }

  const isSafe = violations.allergies.length === 0 && violations.restrictions.length === 0;

  return {
    isSafe,
    violations,
    warnings
  };
}

/**
 * Check if an inventory item poses allergy risks for household members
 */
export function checkInventoryAgainstHouseholdAllergies(
  item: PantryItem,
  householdMembers: Member[]
): { memberViolations: Array<{ member: Member; violations: string[] }> } {
  const memberViolations: Array<{ member: Member; violations: string[] }> = [];

  for (const member of householdMembers) {
    if (!member.allergies?.length) continue;

    const violations = checkAllergies(item.item, member);
    if (violations.length > 0) {
      memberViolations.push({ member, violations });
    }
  }

  return { memberViolations };
}

/**
 * Filter recipes based on household member preferences
 * Returns recipes that are safe for all members or have minimal violations
 */
export function filterRecipesByHouseholdPreferences(
  recipes: (StructuredRecipe | SavedRecipe)[],
  householdMembers: Member[],
  strictMode: boolean = false
): {
  safeRecipes: (StructuredRecipe | SavedRecipe)[];
  riskyRecipes: Array<{
    recipe: StructuredRecipe | SavedRecipe;
    violations: Array<{ member: Member; result: PreferenceCheckResult }>
  }>;
} {
  const safeRecipes: (StructuredRecipe | SavedRecipe)[] = [];
  const riskyRecipes: Array<{
    recipe: StructuredRecipe | SavedRecipe;
    violations: Array<{ member: Member; result: PreferenceCheckResult }>
  }> = [];

  for (const recipe of recipes) {
    const recipeViolations: Array<{ member: Member; result: PreferenceCheckResult }> = [];

    for (const member of householdMembers) {
      const result = checkRecipeAgainstPreferences(recipe, member);
      if (!result.isSafe) {
        recipeViolations.push({ member, result });
      }
    }

    if (recipeViolations.length === 0) {
      // Recipe is safe for all members
      safeRecipes.push(recipe);
    } else if (!strictMode && recipeViolations.every(v => v.result.violations.allergies.length === 0)) {
      // Recipe has restrictions/dislikes but no allergies (allow in non-strict mode)
      riskyRecipes.push({ recipe, violations: recipeViolations });
    }
    // In strict mode, recipes with any violations are excluded
  }

  return { safeRecipes, riskyRecipes };
}

export type CacheMealTypeFilter = '' | 'breakfast' | 'lunch' | 'dinner';

function getRecipeMealType(recipe: StructuredRecipe | SavedRecipe): string {
  const normalizedMealType = normalizeIngredient(((recipe as StructuredRecipe & { mealType?: string }).mealType || ''));
  if (normalizedMealType === 'breakfast' || normalizedMealType === 'lunch' || normalizedMealType === 'dinner') {
    return normalizedMealType;
  }

  const normalizedType = normalizeIngredient(recipe.type || '');
  if (normalizedType.includes('breakfast') || normalizedType.includes('brunch') || normalizedType.includes('morning')) {
    return 'breakfast';
  }
  if (normalizedType.includes('lunch')) {
    return 'lunch';
  }
  return 'dinner';
}

function getRecipeCuisine(recipe: StructuredRecipe | SavedRecipe): string {
  const labeledCuisine = (recipe as StructuredRecipe & { cuisine?: string }).cuisine;
  return normalizeIngredient(labeledCuisine || 'other');
}

/**
 * Apply standardized cache recipe filters used across app searches.
 */
export function recipeMatchesCacheFilters(
  recipe: StructuredRecipe | SavedRecipe,
  filters: { mealType?: CacheMealTypeFilter; cuisine?: string }
): boolean {
  const mealTypeFilter = normalizeIngredient(filters.mealType || '');
  if (mealTypeFilter && getRecipeMealType(recipe) !== mealTypeFilter) {
    return false;
  }

  const cuisineFilter = normalizeIngredient(filters.cuisine || '');
  if (cuisineFilter && getRecipeCuisine(recipe) !== cuisineFilter) {
    return false;
  }

  return true;
}

/**
 * Score a recipe by household/user likes/dislikes so callers can rank matches.
 */
export function scoreRecipeForPreferences(
  recipe: StructuredRecipe | SavedRecipe,
  householdMembers: Member[] = [],
  userProfile?: UserProfile
): number {
  const text = normalizeIngredient([
    recipe.title || '',
    recipe.description || '',
    recipe.type || '',
    getRecipeCuisine(recipe),
    Array.isArray(recipe.ingredients) ? recipe.ingredients.join(' ') : ''
  ].join(' '));

  let score = 0;

  const scoreMember = (member: Pick<Member, 'favoriteCuisines' | 'preferredProteins' | 'dislikedIngredients'>) => {
    for (const cuisine of member.favoriteCuisines || []) {
      if (text.includes(normalizeIngredient(cuisine))) score += 6;
    }
    for (const protein of member.preferredProteins || []) {
      if (text.includes(normalizeIngredient(protein))) score += 4;
    }
    for (const dislike of member.dislikedIngredients || []) {
      if (text.includes(normalizeIngredient(dislike))) score -= 8;
    }
  };

  for (const member of householdMembers) {
    scoreMember(member);
  }

  if (userProfile) {
    scoreMember({
      favoriteCuisines: userProfile.favoriteCuisines,
      preferredProteins: userProfile.preferredProteins,
      dislikedIngredients: userProfile.dislikedIngredients
    });
  }

  return score;
}

export function rankCachedRecipesByPreferences<T extends StructuredRecipe | SavedRecipe>(
  recipes: T[],
  householdMembers: Member[] = [],
  userProfile?: UserProfile
): T[] {
  return [...recipes].sort((a, b) => {
    const bScore = scoreRecipeForPreferences(b, householdMembers, userProfile);
    const aScore = scoreRecipeForPreferences(a, householdMembers, userProfile);
    if (bScore !== aScore) return bScore - aScore;
    return (a.title || '').localeCompare(b.title || '');
  });
}

/**
 * Check if a recipe fits a user's individual profile preferences
 */
export function checkRecipeAgainstUserProfile(
  recipe: StructuredRecipe | SavedRecipe,
  userProfile: UserProfile
): {
  isRecommended: boolean;
  score: number; // 0-100, higher is better match
  reasons: string[];
} {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Check diet goal alignment
  if (userProfile.dietGoal && recipe.nutrition?.calories) {
    const macroTargets = getUserNutritionTargets(userProfile);
    if (macroTargets) {
      const recipeNutrition = {
        calories: recipe.nutrition.calories,
        protein: recipe.nutrition.protein,
        carbs: recipe.nutrition.carbs,
        fat: recipe.nutrition.fat
      };
      const macroCheck = checkRecipeMacros(recipeNutrition, macroTargets, 0.3); // 30% tolerance
      if (macroCheck.fits) {
        score += 20;
        reasons.push(`Fits your ${userProfile.dietGoal} nutrition goals`);
      } else {
        score -= 10;
        reasons.push(`May not align with your ${userProfile.dietGoal} goals`);
      }
    }
  }

  // Check preferred cuisines
  if (userProfile.favoriteCuisines?.length && recipe.description) {
    const recipeCuisines = userProfile.favoriteCuisines.filter(cuisine =>
      recipe.description?.toLowerCase().includes(cuisine.toLowerCase()) ||
      recipe.title?.toLowerCase().includes(cuisine.toLowerCase())
    );
    if (recipeCuisines.length > 0) {
      score += 15;
      reasons.push(`Matches your preferred cuisine: ${recipeCuisines.join(', ')}`);
    }
  }

  // Check preferred proteins
  if (userProfile.preferredProteins?.length && Array.isArray(recipe.ingredients)) {
    const recipeProteins = userProfile.preferredProteins.filter(protein =>
      recipe.ingredients.some(ingredient =>
        ingredient.toLowerCase().includes(protein.toLowerCase())
      )
    );
    if (recipeProteins.length > 0) {
      score += 10;
      reasons.push(`Includes your preferred proteins: ${recipeProteins.join(', ')}`);
    }
  }

  // Check disliked ingredients
  if (userProfile.dislikedIngredients?.length && Array.isArray(recipe.ingredients)) {
    const dislikedFound = userProfile.dislikedIngredients.filter(disliked =>
      recipe.ingredients.some(ingredient =>
        ingredient.toLowerCase().includes(disliked.toLowerCase())
      )
    );
    if (dislikedFound.length > 0) {
      score -= 25;
      reasons.push(`Contains ingredients you dislike: ${dislikedFound.join(', ')}`);
    }
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score));

  return {
    isRecommended: score >= 60,
    score,
    reasons
  };
}

/**
 * Filter and score recipes based on individual user profile
 */
export function filterRecipesByUserProfile(
  recipes: (StructuredRecipe | SavedRecipe)[],
  userProfile: UserProfile
): Array<{
  recipe: StructuredRecipe | SavedRecipe;
  score: number;
  reasons: string[];
  isRecommended: boolean;
}> {
  return recipes.map(recipe => {
    const profileCheck = checkRecipeAgainstUserProfile(recipe, userProfile);
    return {
      recipe,
      score: profileCheck.score,
      reasons: profileCheck.reasons,
      isRecommended: profileCheck.isRecommended
    };
  }).sort((a, b) => b.score - a.score); // Sort by score descending
}
