/**
 * Nutrition Facts Service
 * Fetches nutrition information from USDA FoodData Central API (free, no key required)
 * Provides automatic nutrition facts for pantry items
 * Uses localStorage for persistent caching across sessions
 */

export interface NutritionFacts {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  servingSize: string | null;
  foodName: string;
}

const NUTRITION_CACHE_KEY = 'nutrition_cache';
const CACHE_EXPIRY_DAYS = 90; // Cache nutrition data for 90 days

interface CachedNutrition {
  data: NutritionFacts | null;
  timestamp: number;
}

/**
 * Get cache from localStorage
 */
const getCache = (): Map<string, CachedNutrition> => {
  try {
    const cached = localStorage.getItem(NUTRITION_CACHE_KEY);
    if (!cached) return new Map();
    const obj = JSON.parse(cached);
    return new Map(Object.entries(obj) as [string, CachedNutrition][]);
  } catch (error) {
    console.warn('Failed to load nutrition cache from localStorage:', error);
    return new Map();
  }
};

/**
 * Save cache to localStorage
 */
const saveCache = (cache: Map<string, CachedNutrition>) => {
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(NUTRITION_CACHE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.warn('Failed to save nutrition cache to localStorage:', error);
  }
};

/**
 * Check if cached entry is still valid (not expired)
 */
const isCacheValid = (timestamp: number): boolean => {
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp < expiryMs;
};

/**
 * Fuzzy match helper - checks if query words appear in target
 */
const fuzzyMatch = (query: string, target: string): number => {
  const queryWords = query.toLowerCase().split(/\s+/);
  const targetWords = target.toLowerCase().split(/\s+/);
  
  let matchCount = 0;
  for (const qWord of queryWords) {
    for (const tWord of targetWords) {
      if (tWord.includes(qWord) || qWord.includes(tWord)) {
        matchCount++;
        break;
      }
    }
  }
  
  // Return match score (0-1)
  return queryWords.length > 0 ? matchCount / queryWords.length : 0;
};

/**
 * Try multiple search strategies to find nutrition data
 */
const searchWithFallbacks = async (itemName: string): Promise<any[] | null> => {
  const searchTerms = [
    itemName, // Exact
    itemName.split(/\s+/)[0], // First word only
    itemName.replace(/brand names/i, '').trim(), // Remove brand names (Barilla, etc)
  ];

  for (const term of searchTerms) {
    if (!term || term.length < 2) continue;
    
    try {
      const searchResponse = await fetch(
        `https://fdc.nal.usda.gov/api/foods/search?query=${encodeURIComponent(term)}&pageSize=5`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.foods && data.foods.length > 0) {
          // Sort by fuzzy match score
          data.foods.sort((a: any, b: any) => {
            const scoreA = fuzzyMatch(itemName, a.description);
            const scoreB = fuzzyMatch(itemName, b.description);
            return scoreB - scoreA;
          });
          return data.foods;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
};

/**
 * Fetch nutrition facts for a food item from USDA FoodData Central API
 * Returns null if not found or on error
 */
export const getNutritionFacts = async (itemName: string): Promise<NutritionFacts | null> => {
  const cacheKey = itemName.toLowerCase();
  
  // Check localStorage cache first
  const cache = getCache();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (isCacheValid(cached.timestamp)) {
      return cached.data;
    } else {
      // Remove expired entry
      cache.delete(cacheKey);
      saveCache(cache);
    }
  }

  try {
    // Search for the food item in USDA database with fallback strategies
    const foods = await searchWithFallbacks(itemName);
    
    if (!foods || foods.length === 0) {
      console.warn(`No nutrition data found for: ${itemName}`);
      // Cache the negative result for 7 days to avoid repeated API calls
      cache.set(cacheKey, { data: null, timestamp: Date.now() });
      saveCache(cache);
      return null;
    }

    const foodItem = foods[0];
    const foodFdcId = foodItem.fdcId;

    // Get detailed nutrition information
    const detailResponse = await fetch(
      `https://fdc.nal.usda.gov/api/foods/${foodFdcId}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!detailResponse.ok) {
      console.warn('Nutrition detail fetch failed:', detailResponse.statusText);
      return null;
    }

    const foodDetail = await detailResponse.json();
    const nutrients = foodDetail.foodNutrients || [];

    // Extract key nutrients (per 100g standard serving)
    const getNutrientValue = (nutrientName: string): number | null => {
      const nutrient = nutrients.find((n: any) =>
        n.nutrient?.name?.toLowerCase().includes(nutrientName.toLowerCase())
      );
      return nutrient?.value || null;
    };

    const nutritionData: NutritionFacts = {
      calories: getNutrientValue('energy') || getNutrientValue('calorie'),
      protein: getNutrientValue('protein'),
      carbs: getNutrientValue('carbohydrate'),
      fat: getNutrientValue('fat'),
      fiber: getNutrientValue('fiber'),
      sugar: getNutrientValue('sugar'),
      servingSize: foodDetail.servingSize ? `${foodDetail.servingSize}${foodDetail.servingSizeUnit || 'g'}` : '100g',
      foodName: foodItem.description,
    };

    // Cache the result
    cache.set(cacheKey, { data: nutritionData, timestamp: Date.now() });
    saveCache(cache);
    return nutritionData;
  } catch (error) {
    console.warn(`Error fetching nutrition for ${itemName}:`, error);
    return null;
  }
};

/**
 * Get nutrition facts with fallback to generic category estimates
 */
export const getNutritionFactsWithFallback = async (itemName: string, category: string): Promise<NutritionFacts | null> => {
  try {
    // First try exact item lookup
    const nutrition = await getNutritionFacts(itemName);
    if (nutrition) {
      return nutrition;
    }

    // If not found, try broader search by category
    console.log(`Nutrition not found for ${itemName}, trying category: ${category}`);
    return await getNutritionFacts(category);
  } catch (error) {
    console.warn('Error in nutrition fallback:', error);
    return null;
  }
};

/**
 * Format nutrition facts for display
 */
export const formatNutrition = (nutrition: NutritionFacts | null): Record<string, string> => {
  if (!nutrition) {
    return {
      status: 'No nutrition data available',
    };
  }

  return {
    calories: nutrition.calories ? `${Math.round(nutrition.calories)} cal` : 'N/A',
    protein: nutrition.protein ? `${nutrition.protein.toFixed(1)}g` : 'N/A',
    carbs: nutrition.carbs ? `${nutrition.carbs.toFixed(1)}g` : 'N/A',
    fat: nutrition.fat ? `${nutrition.fat.toFixed(1)}g` : 'N/A',
    fiber: nutrition.fiber ? `${nutrition.fiber.toFixed(1)}g` : 'N/A',
    sugar: nutrition.sugar ? `${nutrition.sugar.toFixed(1)}g` : 'N/A',
    servingSize: nutrition.servingSize || '100g',
  };
};

/**
 * Clear nutrition cache (useful for testing or manual refresh)
 */
export const clearNutritionCache = () => {
  try {
    localStorage.removeItem(NUTRITION_CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear nutrition cache:', error);
  }
};
