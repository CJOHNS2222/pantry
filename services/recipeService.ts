import { collection, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";
import DatabaseMonitoringService from "./databaseMonitoringService";
import { StructuredRecipe, SavedRecipe } from "../types";
import { getPerformance, trace } from "firebase/performance";
import { withErrorHandling, AppError, ErrorCode } from "../utils/errorUtils";

const SPOONACULAR_API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";
const performance = getPerformance();

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType: string;
  servings: number;
  readyInMinutes: number;
  license: string;
  sourceName: string;
  sourceUrl: string;
  spoonacularSourceUrl: string;
  aggregateLikes: number;
  healthScore: number;
  spoonacularScore: number;
  pricePerServing: number;
  analyzedInstructions: any[];
  cheap: boolean;
  creditsText: string;
  cuisines: string[];
  dairyFree: boolean;
  diets: string[];
  gaps: string;
  glutenFree: boolean;
  instructions: string;
  ketogenic: boolean;
  lowFodmap: boolean;
  occasions: string[];
  sustainable: boolean;
  vegan: boolean;
  vegetarian: boolean;
  veryHealthy: boolean;
  veryPopular: boolean;
  whole30: boolean;
  weightWatcherSmartPoints: number;
  dishTypes: string[];
  extendedIngredients: any[];
  summary: string;
  winePairing: any;
}

export interface BulkUploadResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Fetch recipes from Spoonacular API
 */
export const fetchRecipesFromSpoonacular = async (
  query: string = "",
  number: number = 10,
  offset: number = 0
): Promise<SpoonacularRecipe[]> => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'fetch_spoonacular_recipes');
    perfTrace.start();

    try {
      if (!SPOONACULAR_API_KEY) {
        throw new AppError(
          ErrorCode.API_ERROR,
          "Spoonacular API key not configured",
          "Recipe search is currently unavailable. Please try again later.",
          { retryable: false }
        );
      }

      const params = new URLSearchParams({
        apiKey: SPOONACULAR_API_KEY,
        number: number.toString(),
        offset: offset.toString(),
        addRecipeInformation: "true",
        fillIngredients: "true"
      });

      if (query) {
        params.append("query", query);
      }

      // Add custom metrics
      perfTrace.putMetric('query_length', query.length);
      perfTrace.putMetric('requested_count', number);
      perfTrace.putMetric('offset', offset);

      const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`);

      if (!response.ok) {
        throw AppError.fromApiError(response, { query, number, offset });
      }

      const data = await response.json();
      const results = data.results || [];

      // Add more metrics
      perfTrace.putMetric('results_returned', results.length);

      return results;
    } finally {
      perfTrace.stop();
    }
  }, { operation: 'fetchRecipesFromSpoonacular', query, number, offset }, { retries: 2 });
};

/**
 * Convert Spoonacular recipe to our StructuredRecipe format
 */
export const convertSpoonacularToStructured = (spoonacularRecipe: SpoonacularRecipe): StructuredRecipe => {
  return {
    title: spoonacularRecipe.title,
    description: spoonacularRecipe.summary?.replace(/[<>]/g, '') || `${spoonacularRecipe.title} - A delicious recipe`,
    ingredients: spoonacularRecipe.extendedIngredients?.map(ing =>
      `${ing.amount} ${ing.unit} ${ing.name}`
    ) || [],
    instructions: spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map(step =>
      step.step
    ) || [spoonacularRecipe.instructions || "Instructions not available"],
    cookTime: `${spoonacularRecipe.readyInMinutes} mins`,
    type: spoonacularRecipe.dishTypes?.[0] || "Dinner",
    image: spoonacularRecipe.image
  };
};

/**
 * Download and upload image to Firebase Storage
 */
export const uploadRecipeImage = async (imageUrl: string, recipeId: string): Promise<string> => {
  const perfTrace = trace(performance, 'upload_recipe_image');
  perfTrace.start();

  try {
    // Download image from Spoonacular
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const blob = await response.blob();

    // Add custom metrics
    perfTrace.putMetric('image_size_bytes', blob.size);

    // Upload to Firebase Storage
    const storageRef = ref(storage, `recipes/${recipeId}.jpg`);
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading recipe image:", error);
    perfTrace.putAttribute('result', 'fallback_to_original');
    return imageUrl; // Return original URL if upload fails
  } finally {
    perfTrace.stop();
  }
};

/**
 * Save recipe to Firestore
 */
export const saveRecipeToFirestore = async (recipe: StructuredRecipe): Promise<string> => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'save_recipe_firestore');
    perfTrace.start();

    try {
      const savedRecipe: Omit<SavedRecipe, 'id'> = {
        ...recipe,
        dateSaved: new Date().toISOString()
      };

      // Add custom metrics
      perfTrace.putMetric('ingredients_count', recipe.ingredients.length);
      perfTrace.putMetric('instructions_count', recipe.instructions.length);
      perfTrace.putAttribute('has_image', recipe.image ? 'true' : 'false');

      const docRef = await addDoc(collection(db, "recipes"), savedRecipe);
      return docRef.id;
    } finally {
      perfTrace.stop();
    }
  }, { operation: 'saveRecipeToFirestore', recipeTitle: recipe.title }, { retries: 1 });
};

/**
 * Bulk upload recipes from Spoonacular
 */
export const bulkUploadRecipes = async (
  searchQueries: string[] = ["chicken", "beef", "pasta", "vegetarian", "dessert"],
  recipesPerQuery: number = 10,
  onProgress?: (completed: number, total: number) => void
): Promise<BulkUploadResult> => {
  const perfTrace = trace(performance, 'bulk_upload_recipes');
  perfTrace.start();

  try {
    const result: BulkUploadResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    const totalQueries = searchQueries.length;
    let completedQueries = 0;

    // Add custom metrics
    perfTrace.putMetric('total_queries', totalQueries);
    perfTrace.putMetric('recipes_per_query', recipesPerQuery);

    for (const searchQuery of searchQueries) {
      try {
        console.log(`Fetching recipes for: ${searchQuery}`);

        // Fetch recipes from Spoonacular
        const spoonacularRecipes = await fetchRecipesFromSpoonacular(searchQuery, recipesPerQuery);

        for (const spoonacularRecipe of spoonacularRecipes) {
          try {
            // Convert to our format
            const structuredRecipe = convertSpoonacularToStructured(spoonacularRecipe);

            // Save to Firestore first to get ID
            const recipeId = await saveRecipeToFirestore(structuredRecipe);

            // Upload image if available
            if (structuredRecipe.image) {
              const uploadedImageUrl = await uploadRecipeImage(structuredRecipe.image, recipeId);

              // Update recipe with uploaded image URL
              await setDoc(doc(db, "recipes", recipeId), {
                ...structuredRecipe,
                id: recipeId,
                dateSaved: new Date().toISOString(),
                image: uploadedImageUrl
              }, { merge: true });
            }

            result.success++;
            console.log(`Saved recipe: ${structuredRecipe.title}`);

          } catch (recipeError) {
            result.failed++;
            result.errors.push(`Failed to save recipe "${spoonacularRecipe.title}": ${recipeError}`);
            console.error(`Failed to save recipe:`, recipeError);
          }
        }

        completedQueries++;
        onProgress?.(completedQueries, totalQueries);

        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (queryError) {
        result.errors.push(`Failed to fetch recipes for "${searchQuery}": ${queryError}`);
        console.error(`Failed to fetch recipes for ${searchQuery}:`, queryError);
        completedQueries++;
        onProgress?.(completedQueries, totalQueries);
      }
    }

    // Add final metrics
    perfTrace.putMetric('total_success', result.success);
    perfTrace.putMetric('total_failed', result.failed);

    return result;
  } finally {
    perfTrace.stop();
  }
};

/**
 * Get all saved recipes from Firestore
 */
export const getSavedRecipes = async (limitCount: number = 50): Promise<SavedRecipe[]> => {
  try {
    // Option 1: Use direct Firestore (current)
    // const q = query(collection(db, "recipes"), orderBy("dateSaved", "desc"), limit(limitCount));
    // const querySnapshot = await getDocs(q);

    // Option 2: Use DatabaseMonitoringService for tracking (recommended for analytics)
    const recipesRef = DatabaseMonitoringService.collection("recipes");
    const q = query(recipesRef, orderBy("dateSaved", "desc"), limit(limitCount));
    const querySnapshot = await DatabaseMonitoringService.getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SavedRecipe));
  } catch (error) {
    console.error("Error fetching saved recipes:", error);
    return [];
  }
};

/**
 * Get cached popular recipes from a single document (much more efficient - 1 read vs 50+ reads)
 */
/**
 * Get cached popular recipes from a single document (much more efficient - 1 read vs 50+ reads)
 */
export const getCachedPopularRecipes = async (): Promise<SavedRecipe[]> => {
  try {
    const popularRecipesRef = doc(db, "system", "popular_recipes");
    const docSnap = await DatabaseMonitoringService.getDoc(popularRecipesRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const recipes = data?.recipes || [];
      // Remove duplicates based on title to ensure clean data
      const uniqueRecipes = recipes.filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      );
      console.log(`✅ Loaded ${uniqueRecipes.length} cached recipes (1 database read)`);
      return uniqueRecipes;
    }

    // If no cached recipes exist, fall back to the old method but cache the result
    console.log("📥 No cached popular recipes found, loading and caching 50 recipes...");
    const recipes = await getSavedRecipes(50);
    // Remove duplicates before caching
    const uniqueRecipes = recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );

    // Try to cache for future use (don't fail if caching fails)
    try {
      await cachePopularRecipes(uniqueRecipes);
      console.log(`💾 Cached ${uniqueRecipes.length} recipes for future fast loading`);
    } catch (cacheError) {
      console.warn("⚠️ Failed to cache recipes, but continuing with loaded recipes:", cacheError);
    }

    return uniqueRecipes;
  } catch (error) {
    console.error("❌ Error fetching cached popular recipes:", error);
    // Fall back to direct loading if caching fails
    console.log("🔄 Falling back to direct recipe loading...");
    const recipes = await getSavedRecipes(50);
    // Remove duplicates even in fallback
    return recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );
  }
};

/**
 * Cache popular recipes in a single document for efficient loading
 */
export const cachePopularRecipes = async (recipes: SavedRecipe[]): Promise<void> => {
  try {
    // Only cache if user is authenticated (required by Firestore rules)
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    if (!auth.currentUser) {
      console.log("⚠️ User not authenticated, skipping recipe caching");
      return;
    }

    const popularRecipesRef = doc(db, "system", "popular_recipes");
    await DatabaseMonitoringService.setDoc(popularRecipesRef, {
      recipes,
      lastUpdated: new Date(),
      version: 1
    });
    console.log(`💾 Cached ${recipes.length} popular recipes for efficient loading`);
  } catch (error) {
    console.error("❌ Error caching popular recipes:", error);
    // Don't throw - caching failure shouldn't break the app
  }
};

/**
 * Search recipes in Firestore
 */
export const searchRecipesInFirestore = async (searchTerm: string): Promise<SavedRecipe[]> => {
  const perfTrace = trace(performance, 'search_recipes_firestore');
  perfTrace.start();

  try {
    // Note: Firestore doesn't support full-text search natively
    // This is a simple implementation - you might want to use Algolia or Elastic Search for better search
    // Option 1: Use direct Firestore (current)
    // const q = query(collection(db, "recipes"));
    // const querySnapshot = await getDocs(q);

    // Option 2: Use DatabaseMonitoringService for tracking (recommended for analytics)
    const recipesRef = DatabaseMonitoringService.collection("recipes");
    const q = query(recipesRef);
    const querySnapshot = await DatabaseMonitoringService.getDocs(q);

    const allRecipes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SavedRecipe));

    // Filter by search term (case-insensitive)
    const filteredRecipes = allRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Add custom metrics
    perfTrace.putMetric('search_term_length', searchTerm.length);
    perfTrace.putMetric('total_recipes_searched', allRecipes.length);
    perfTrace.putMetric('results_found', filteredRecipes.length);

    return filteredRecipes;
  } catch (error) {
    console.error("Error searching recipes:", error);
    return [];
  } finally {
    perfTrace.stop();
  }
}