import DatabaseMonitoringService from "./databaseMonitoringService";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";
import { StructuredRecipe, SavedRecipe } from "../types";
import { getPerformance, trace } from "firebase/performance";
import { withErrorHandling, AppError, ErrorCode } from "../utils/errorUtils";
import { log } from "./logService";
import { serverTimestamp } from 'firebase/firestore';

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
 * Read the single-document cache containing community-rated full recipes.
 * Falls back to loading saved recipes if the cache is missing.
 */
export const getCachedCommunityRatedRecipes = async (): Promise<SavedRecipe[]> => {
  try {
    const ref = DatabaseMonitoringService.doc('system/community_rated_recipes');
    const docSnap = await DatabaseMonitoringService.getDoc(ref);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const recipes = data?.recipes || [];
      console.log(`✅ Loaded ${recipes.length} community-rated recipes (1 database read)`);
      return recipes as SavedRecipe[];
    }

    // Fallback to retrieving saved recipes (not ideal but safe)
    console.log('📥 No community-rated cache found, falling back to saved recipes');
    return await getSavedRecipes(50);
  } catch (err: any) {
    console.error('❌ Error fetching community-rated cache:', err);
    return await getSavedRecipes(50);
  }
};

/**
 * Rebuild `system/community_rated_recipes` by aggregating `recipeRatings` and
 * enrichment from `recipeCommunityStats` and `recipes` collection. Intended for
 * admin scripts or Cloud Functions.
 */
export const rebuildCommunityRatedRecipesFromRatings = async (days: number = 30, minRatings: number = 1, topN: number = 50): Promise<void> => {
  const perfTrace = trace(performance, 'rebuild_community_rated_recipes');
  perfTrace.start();

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const ratingsRef = DatabaseMonitoringService.collection('recipeRatings');
    const q = DatabaseMonitoringService.query(ratingsRef, DatabaseMonitoringService.where('date', '>', cutoff));
    const snap = await DatabaseMonitoringService.getDocs(q);

    const counts: Record<string, { count: number; sum: number; ids: Set<string> }> = {};
    for (const d of snap.docs) {
      const data = d.data() as any;
      const title = data.recipeTitle || (data.recipeId ?? 'Unknown Recipe');
      const rating = typeof data.rating === 'number' ? data.rating : 0;
      if (!counts[title]) counts[title] = { count: 0, sum: 0, ids: new Set() };
      counts[title].count += 1;
      counts[title].sum += rating;
      if (data.recipeId) counts[title].ids.add(data.recipeId);
    }

    const aggregated = Object.entries(counts)
      .map(([title, v]) => ({ title, popularityCount: v.count, averageRating: v.count > 0 ? v.sum / v.count : 0, recipeIds: Array.from(v.ids) }))
      .filter(x => x.popularityCount >= minRatings)
      .sort((a, b) => b.popularityCount - a.popularityCount || b.averageRating - a.averageRating)
      .slice(0, topN);

    const results: any[] = [];
    for (const item of aggregated) {
      let recipeDoc: any = null;
      // prefer recipeId if available
      if (item.recipeIds && item.recipeIds.length > 0) {
        try {
          const docRef = DatabaseMonitoringService.doc(`recipes/${item.recipeIds[0]}`);
          const ds = await DatabaseMonitoringService.getDoc(docRef);
          if (ds && ds.exists && typeof ds.exists === 'function' ? ds.exists() : ds.exists) recipeDoc = { id: ds.id, ...ds.data() };
        } catch (e) { /* ignore */ }
      }

      if (!recipeDoc) {
        try {
          const recipesQuery = DatabaseMonitoringService.query(DatabaseMonitoringService.collection('recipes'), DatabaseMonitoringService.where('title', '==', item.title), DatabaseMonitoringService.limit(1));
          const rq = await DatabaseMonitoringService.getDocs(recipesQuery);
          if (rq.docs.length > 0) recipeDoc = { id: rq.docs[0].id, ...rq.docs[0].data() };
        } catch (e) { /* ignore */ }
      }

      const entry: any = recipeDoc ? { ...recipeDoc } : { id: null, title: item.title, description: null, ingredients: [], instructions: [], image: null };

      entry.popularityCount = item.popularityCount;
      entry.averageRating = item.averageRating;

      // Attach community stats if present
      try {
        const statsRef = DatabaseMonitoringService.doc(`recipeCommunityStats/${item.title}`);
        const statsSnap = await DatabaseMonitoringService.getDoc(statsRef);
        if (statsSnap && statsSnap.exists && typeof statsSnap.exists === 'function' ? statsSnap.exists() : statsSnap.exists) entry.communityStats = statsSnap.data();
      } catch (e) { /* ignore */ }

      results.push(entry);
    }

    const cacheRef = DatabaseMonitoringService.doc('system/community_rated_recipes');
    await DatabaseMonitoringService.setDoc(cacheRef, { recipes: results, lastUpdated: new Date(), version: 1 });

    perfTrace.putMetric('community_cached_count', results.length);
    log.info('Rebuilt community-rated recipes cache', { count: results.length });
  } catch (err: any) {
    log.error('Failed to rebuild community-rated recipes cache', { error: err });
  } finally {
    perfTrace.stop();
  }
};

/**
 * Upsert a single recipe entry into the single-doc community cache `system/community_rated_recipes`.
 * Fetches the `recipeCommunityStats/{title}` document and the `recipes` doc (by id or title)
 * and writes/updates the entry inside the cached array so reads become a single document.
 */
export const upsertCommunityRatedRecipeByTitle = async (title: string): Promise<void> => {
  try {
    // Fetch community stats
    const statsRef = DatabaseMonitoringService.doc(`recipeCommunityStats/${title}`);
    const statsSnap = await DatabaseMonitoringService.getDoc(statsRef);
    const stats = statsSnap && statsSnap.exists && typeof statsSnap.exists === 'function' ? (statsSnap.exists() ? statsSnap.data() : {}) : (statsSnap && statsSnap.exists ? statsSnap.data() : {});

    // Try to locate the recipe document by title (or id if stats contains one)
    let recipeDoc: any = null;
    try {
      // If stats contains a recipeId, try that first
      const possibleId = (stats as any).recipeId;
      if (possibleId) {
        const rd = await DatabaseMonitoringService.getDoc(DatabaseMonitoringService.doc(`recipes/${possibleId}`));
        if (rd && rd.exists && typeof rd.exists === 'function' ? rd.exists() : rd.exists) recipeDoc = { id: rd.id, ...rd.data() };
      }
    } catch (e) { /* ignore */ }

    if (!recipeDoc) {
      try {
        const q = DatabaseMonitoringService.query(DatabaseMonitoringService.collection('recipes'), DatabaseMonitoringService.where('title', '==', title), DatabaseMonitoringService.limit(1));
        const rq = await DatabaseMonitoringService.getDocs(q);
        if (rq && rq.docs && rq.docs.length > 0) recipeDoc = { id: rq.docs[0].id, ...rq.docs[0].data() };
      } catch (e) { /* ignore */ }
    }

    const entry: any = recipeDoc ? { ...recipeDoc } : { id: null, title, description: null, ingredients: [], instructions: [], image: null };

    // Attach rating metadata from stats
    entry.totalRatings = stats?.totalRatings ?? (stats?.ratingsCount ?? 0);
    entry.averageRating = stats?.averageRating ?? null;
    entry.wouldMakeAgainPercentage = stats?.wouldMakeAgainPercentage ?? null;
    entry.topFeedback = stats?.topFeedback ?? [];
    entry.lastUpdated = stats?.lastUpdated ?? new Date().toISOString();

    // Upsert into the single-doc cache
    const cacheRef = DatabaseMonitoringService.doc('system/community_rated_recipes');
    const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);
    let arr: any[] = [];
    if (cacheSnap && cacheSnap.exists && typeof cacheSnap.exists === 'function' ? cacheSnap.exists() : cacheSnap.exists) {
      const data = cacheSnap.data();
      arr = Array.isArray(data.recipes) ? data.recipes : [];
    }

    const idx = arr.findIndex(r => (r.id && entry.id && r.id === entry.id) || (r.title === entry.title));
    if (idx >= 0) {
      arr[idx] = entry;
    } else {
      arr.unshift(entry);
    }

    // Optional trim to keep document size reasonable
    if (arr.length > 500) arr.length = 500;

    await DatabaseMonitoringService.setDoc(cacheRef, { recipes: arr, lastUpdated: serverTimestamp(), version: 1 });
    log.info('Upserted community-rated recipe cache entry', { title });
  } catch (err: any) {
    log.error('Failed to upsert community-rated recipe', { error: err, title });
  }
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
    instructions: spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map((step: any) =>
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
  } catch (err: any) {
    log.error("Error uploading recipe image", { error: err, recipeId }, "RecipeService");
    perfTrace.putAttribute('result', 'fallback_to_original');
    return imageUrl; // Return original URL if upload fails
  } finally {
    perfTrace.stop();
  }
};

/**
 * Save recipe to Firestore
 */
export const saveRecipeToFirestore = async (
  recipe: StructuredRecipe,
  options?: { userId?: string; visibility?: 'public' | 'private' }
): Promise<string> => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'save_recipe_firestore');
    perfTrace.start();

    try {
      const savedRecipe: any = {
        ...recipe,
        dateSaved: new Date().toISOString(),
        userId: options?.userId ?? undefined,
        visibility: options?.visibility ?? 'private'
      };

      // Add custom metrics
      perfTrace.putMetric('ingredients_count', recipe.ingredients.length);
      perfTrace.putMetric('instructions_count', recipe.instructions.length);
      perfTrace.putAttribute('has_image', recipe.image ? 'true' : 'false');

      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection("recipes"), savedRecipe as any);
      return docRef.id;
    } finally {
      perfTrace.stop();
    }
  }, { operation: 'saveRecipeToFirestore', recipeTitle: recipe.title }, { retries: 1 });
};

/**
 * Upload a File object to Firebase Storage for a recipe and return the download URL
 */
export const uploadRecipeImageFile = async (file: File, recipeId: string): Promise<string> => {
  const perfTrace = trace(performance, 'upload_recipe_image_file');
  perfTrace.start();

  try {
    // Upload the provided file directly
    const storageRef = ref(storage, `recipes/${recipeId}.jpg`);
    await uploadBytes(storageRef, file as any);
    const downloadURL = await getDownloadURL(storageRef);
    perfTrace.putAttribute('result', 'uploaded');
    return downloadURL;
  } catch (err: any) {
    log.error('Error uploading recipe image file', { error: err, recipeId }, 'RecipeService');
    perfTrace.putAttribute('result', 'error');
    throw err;
  } finally {
    perfTrace.stop();
  }
};

/**
 * Submit a recipe for staff review (copy into recipes/submissions)
 */
export const submitRecipeForReview = async (recipe: StructuredRecipe, submitterId?: string) => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'submit_recipe_for_review');
    perfTrace.start();

    try {
      const submission = {
        ...recipe,
        dateSubmitted: new Date().toISOString(),
        submitterId: submitterId || null,
        status: 'pending'
      } as any;

      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection('recipes/submissions'), submission);
      return docRef.id;
    } finally {
      perfTrace.stop();
    }
  }, { operation: 'submitRecipeForReview', title: recipe.title }, { retries: 1 });
};

/**
 * Save a recipe into the user's single-cache document (users/{uid}/cache/savedRecipes)
 * Returns the generated recipe id stored in the cache.
 */
export const saveRecipeToUserCache = async (uid: string, recipe: StructuredRecipe): Promise<string> => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'save_recipe_user_cache');
    perfTrace.start();

    try {
      const cacheRef = DatabaseMonitoringService.doc(`users/${uid}/cache/savedRecipes`);
      const snap = await DatabaseMonitoringService.getDoc(cacheRef);

      const recipeId = `r_${Date.now()}`;
      const savedItem: any = {
        ...recipe,
        id: recipeId,
        dateSaved: new Date().toISOString(),
        userId: uid,
        visibility: 'private'
      };

      if (snap && (snap as any).exists && (snap as any).data && (snap as any).data().recipes) {
        const existing = (snap as any).data();
        const arr = Array.isArray(existing.recipes) ? existing.recipes : [];
        // prepend new recipe
        arr.unshift(savedItem);
        // Optionally trim to reasonable length (e.g., 500)
        if (arr.length > 500) arr.length = 500;
        await DatabaseMonitoringService.updateDoc(cacheRef, { recipes: arr, lastUpdated: serverTimestamp() });
      } else {
        await DatabaseMonitoringService.setDoc(cacheRef, { recipes: [savedItem], lastUpdated: serverTimestamp() });
      }

      return recipeId;
    } finally {
      perfTrace.stop();
    }
  }, { operation: 'saveRecipeToUserCache', recipeTitle: recipe.title, userId: uid }, { retries: 1 });
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
              await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc("recipes/" + recipeId), {
                ...structuredRecipe,
                id: recipeId,
                dateSaved: new Date().toISOString(),
                image: uploadedImageUrl
              });
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
    const q = DatabaseMonitoringService.query(recipesRef, DatabaseMonitoringService.orderBy("dateSaved", "desc"), DatabaseMonitoringService.limit(limitCount));
    const querySnapshot = await DatabaseMonitoringService.getDocs(q);

    return querySnapshot.docs.map(doc => {
      const d = doc.data();
      return ({ id: doc.id, ...(d && typeof d === 'object' ? (d as Record<string, any>) : {}) } as SavedRecipe);
    });
  } catch (err: any) {
    console.error("Error fetching saved recipes:", err);
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
    // Prefer admin-written cache at recipe_caches/popular_recipes (admin scripts use this)
    const cachePaths = ["recipe_caches/popular_recipes", "system/popular_recipes"];
    let docSnap: any = null;
    let data: any = null;

    for (const path of cachePaths) {
      try {
        const ref = DatabaseMonitoringService.doc(path);
        docSnap = await DatabaseMonitoringService.getDoc(ref);
        if (docSnap && docSnap.exists()) {
          data = docSnap.data();
          break;
        }
      } catch (e) {
        // continue to next path
      }
    }

    if (data) {
      const recipes = data?.recipes || [];
      // Remove duplicates based on title to ensure clean data
      const uniqueRecipes = (recipes as any[]).filter((recipe: any, index: number, self: any[]) =>
        index === self.findIndex((r: any) => r.title === recipe.title)
      );
      console.log(`✅ Loaded ${uniqueRecipes.length} cached recipes (1 database read)`);
      return uniqueRecipes;
    }

    // If no cached recipes exist, fall back to loading individual recipes
    console.log("📥 No cached popular recipes found, falling back to individual recipe loading...");
    const recipes = await getSavedRecipes(50);
    // Remove duplicates even in fallback
    return recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );
  } catch (err: any) {
    console.error("❌ Error fetching cached popular recipes:", err);
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
 * Read a specific recipes cache document under `recipe_caches/{cacheId}`.
 * Example: `recipe_caches/recipes_cache_1` used by MealPlanner to avoid many reads.
 */
export const getCachedRecipesCache = async (cachePath: string = 'recipe_caches/recipes_cache_1'): Promise<SavedRecipe[]> => {
  try {
    const ref = DatabaseMonitoringService.doc(cachePath);
    const docSnap = await DatabaseMonitoringService.getDoc(ref);
    if (docSnap && docSnap.exists && typeof docSnap.exists === 'function' ? docSnap.exists() : docSnap.exists) {
      const data = docSnap.data();
      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      console.log(`✅ Loaded ${recipes.length} cached recipes from ${cachePath} (1 database read)`);
      return recipes as SavedRecipe[];
    }

    console.log(`📥 No cache found at ${cachePath}`);

    // If the `recipe_caches` path is not readable by the client (security rules),
    // try the system fallback path which is readable by authenticated users.
    if (cachePath.startsWith('recipe_caches/')) {
      try {
        const systemPath = cachePath.replace('recipe_caches', 'system');
        const sysRef = DatabaseMonitoringService.doc(systemPath);
        const sysSnap = await DatabaseMonitoringService.getDoc(sysRef);
        if (sysSnap && sysSnap.exists && typeof sysSnap.exists === 'function' ? sysSnap.exists() : sysSnap.exists) {
          const sysData = sysSnap.data();
          const sysRecipes = Array.isArray(sysData?.recipes) ? sysData.recipes : [];
          console.log(`✅ Loaded ${sysRecipes.length} cached recipes from ${systemPath} (1 database read)`);
          return sysRecipes as SavedRecipe[];
        }
      } catch (permErr: any) {
        console.warn(`⚠️ Unable to read ${cachePath} (may be permission denied):`, permErr?.message || permErr);
      }
    }

    console.log(`🔄 Falling back to getSavedRecipes(50)`);
    const recipes = await getSavedRecipes(50);
    return recipes;
  } catch (err: any) {
    console.error(`❌ Error fetching cached recipes at ${cachePath}:`, err);
    // If we got a permission error when reading the cache, try the system path once
    if (cachePath.startsWith('recipe_caches/')) {
      try {
        const systemPath = cachePath.replace('recipe_caches', 'system');
        const sysRef = DatabaseMonitoringService.doc(systemPath);
        const sysSnap = await DatabaseMonitoringService.getDoc(sysRef);
        if (sysSnap && sysSnap.exists && typeof sysSnap.exists === 'function' ? sysSnap.exists() : sysSnap.exists) {
          const sysData = sysSnap.data();
          const sysRecipes = Array.isArray(sysData?.recipes) ? sysData.recipes : [];
          console.log(`✅ Loaded ${sysRecipes.length} cached recipes from ${systemPath} (1 database read)`);
          return sysRecipes as SavedRecipe[];
        }
      } catch (innerErr) {
        console.warn('⚠️ System cache read also failed:', innerErr?.message || innerErr);
      }
    }

    return await getSavedRecipes(50);
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

    const popularRecipesRef = DatabaseMonitoringService.doc("system/popular_recipes");
    await DatabaseMonitoringService.setDoc(popularRecipesRef, {
      recipes,
      lastUpdated: new Date(),
      version: 1
    });
    console.log(`💾 Cached ${recipes.length} popular recipes for efficient loading`);
  } catch (err: any) {
    console.error("❌ Error caching popular recipes:", err);
    // Don't throw - caching failure shouldn't break the app
  }
};

/**
 * Rebuild the `system/popular_recipes` cache by aggregating recent community ratings.
 * Intended to be run by an admin script or Cloud Function (requires appropriate privileges).
 */
export const rebuildCachedPopularRecipesFromRatings = async (days: number = 30, topN: number = 100): Promise<void> => {
  const perfTrace = trace(performance, 'rebuild_cached_popular_recipes');
  perfTrace.start();

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const ratingsRef = DatabaseMonitoringService.collection('recipeRatings');
    const q = DatabaseMonitoringService.query(
      ratingsRef,
      DatabaseMonitoringService.where('date', '>', cutoff),
      DatabaseMonitoringService.where('wouldMakeAgain', '==', true)
    );

    const snap = await DatabaseMonitoringService.getDocs(q);

    const counts: Record<string, { count: number; sumRating: number }> = {};
    for (const d of snap.docs) {
      const data = d.data() as any;
      const title = data.recipeTitle || 'Unknown Recipe';
      const rating = typeof data.rating === 'number' ? data.rating : 0;
      if (!counts[title]) counts[title] = { count: 0, sumRating: 0 };
      counts[title].count += 1;
      counts[title].sumRating += rating;
    }

    const aggregated = Object.entries(counts).map(([title, v]) => ({
      title,
      popularityCount: v.count,
      averageRating: v.count > 0 ? v.sumRating / v.count : 0
    }));

    aggregated.sort((a, b) => b.popularityCount - a.popularityCount || b.averageRating - a.averageRating);

    const top = aggregated.slice(0, topN).map(item => ({
      title: item.title,
      // Keep minimal fields for the cache; UI can fetch full recipe on demand
      popularityCount: item.popularityCount,
      averageRating: item.averageRating
    } as any));

    const popularRecipesRef = DatabaseMonitoringService.doc('system/popular_recipes');
    await DatabaseMonitoringService.setDoc(popularRecipesRef, { recipes: top, lastUpdated: new Date(), version: 1 });

    perfTrace.putMetric('cached_count', top.length);
    log.info('Rebuilt cached popular recipes', { count: top.length });
  } catch (err: any) {
    log.error('Failed to rebuild cached popular recipes', { error: err });
  } finally {
    perfTrace.stop();
  }
};

/**
 * Search recipes in Firestore
 */
export const searchRecipesInFirestore = async (searchTerm: string): Promise<SavedRecipe[]> => {
  const perfTrace = trace(performance, 'search_recipes_firestore');
  perfTrace.start();

  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const searchTermLower = searchTerm.toLowerCase();

    // Use the search index for efficient querying
    const searchIndexRef = DatabaseMonitoringService.collection("recipe_search_index");

    // Query for recipes where searchText contains the search term
    // Note: Firestore doesn't support full text search, so we use array-contains for keywords
    // and prefix matching for searchText
    const q = DatabaseMonitoringService.query(searchIndexRef);
    const querySnapshot = await DatabaseMonitoringService.getDocs(q);

    // Filter in memory for more flexible search (could be optimized further with Algolia)
    const searchResults = [];
    for (const doc of querySnapshot.docs) {
      const searchEntry: any = doc.data() || {};

      // Check if search term matches title, description, ingredients, or keywords
      const matches =
        searchEntry.title?.toLowerCase().includes(searchTermLower) ||
        searchEntry.description?.toLowerCase().includes(searchTermLower) ||
        searchEntry.ingredients?.some((ing: string) => ing.toLowerCase().includes(searchTermLower)) ||
        searchEntry.keywords?.some((kw: string) => kw.includes(searchTermLower)) ||
        searchEntry.searchText?.includes(searchTermLower);

      if (matches) {
        searchResults.push(searchEntry);
      }
    }

    // Get full recipe details for matches (only fetch the recipes we need)
    const fullRecipes: SavedRecipe[] = [];
    if (searchResults.length > 0) {
      // Batch get the full recipes
      const recipeIds = searchResults.map(result => result.id);
      const recipePromises = recipeIds.map(id =>
        DatabaseMonitoringService.getDoc(DatabaseMonitoringService.doc("recipes/" + id))
      );

      const recipeDocs = await Promise.all(recipePromises);

      for (const doc of recipeDocs) {
        if (doc && (typeof (doc as any).exists === 'function' ? (doc as any).exists() : (doc as any).exists)) {
          const d = (doc as any).data ? (doc as any).data() : {};
          fullRecipes.push({ id: doc.id, ...(d && typeof d === 'object' ? d as Record<string, any> : {}) } as SavedRecipe);
        }
      }
    }

    // Add custom metrics
    perfTrace.putMetric('search_term_length', searchTerm.length);
    perfTrace.putMetric('search_index_size', querySnapshot.docs.length);
    perfTrace.putMetric('results_found', fullRecipes.length);

    return fullRecipes;
  } catch (err: any) {
    console.error("Error searching recipes:", err);
    // Fallback to old method if search index fails
    console.log("🔄 Falling back to full collection search...");
    return await searchRecipesInFirestoreFallback(searchTerm);
  } finally {
    perfTrace.stop();
  }
};

// Fallback search method (original implementation)
const searchRecipesInFirestoreFallback = async (searchTerm: string): Promise<SavedRecipe[]> => {
  try {
    const recipesRef = DatabaseMonitoringService.collection("recipes");
    const q = DatabaseMonitoringService.query(recipesRef);
    const querySnapshot = await DatabaseMonitoringService.getDocs(q);

    const allRecipes = querySnapshot.docs.map(doc => {
      const d = doc.data();
      return ({ id: doc.id, ...(d && typeof d === 'object' ? d as Record<string, any> : {}) } as SavedRecipe);
    });

    // Filter by search term (case-insensitive)
    const filteredRecipes = allRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filteredRecipes;
  } catch (err: any) {
    console.error("Error in fallback search:", err);
    return [];
  }
};
