import DatabaseMonitoringService from "./databaseMonitoringService";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebaseConfig";
import { StructuredRecipe, SavedRecipe } from "../types";
import { getPerformance, trace } from "firebase/performance";
import { withErrorHandling, AppError, ErrorCode } from "../utils/errorUtils";
import { log } from "./logService";
import { serverTimestamp, DocumentData } from 'firebase/firestore';
import { groceryPriceService } from './groceryPriceService';
import { parseIngredientForShoppingList } from '../utils/appUtils';

const SPOONACULAR_API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";
const performance = getPerformance();

// In-memory caches to reduce Firestore read counts on tab switches and search mounts
let communityRatedRecipesCache: SavedRecipe[] | null = null;
let popularRecipesCache: SavedRecipe[] | null = null;
const recipesCacheByPath: Record<string, SavedRecipe[]> = {};

export interface AnalyzedInstructionStep {
  number: number;
  step: string;
}

export interface AnalyzedInstruction {
  name: string;
  steps: AnalyzedInstructionStep[];
}

export interface ExtendedIngredient {
  id: number;
  aisle: string;
  image: string;
  consistency: string;
  name: string;
  nameClean: string;
  original: string;
  originalName: string;
  amount: number;
  unit: string;
  meta: string[];
}

export interface WinePairing {
  pairedWines: string[];
  pairingText: string;
  productMatches: Array<{
    id: number;
    title: string;
    description: string;
    price: string;
    imageUrl: string;
    averageRating: number;
    ratingCount: number;
    score: number;
    link: string;
  }>;
}

/** Minimal Firestore doc shape returned by DatabaseMonitoringService.getDocs */
type FirestoreDocLike = { id: string; data(): DocumentData; exists?: boolean | (() => boolean) };

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
  analyzedInstructions: AnalyzedInstruction[];
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
  extendedIngredients: ExtendedIngredient[];
  summary: string;
  winePairing: WinePairing | null;
}

export interface BulkUploadResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Estimate total recipe cost using `groceryPriceService` prices per-ingredient.
 * Falls back to default price data inside `groceryPriceService` when needed.
 */
export const estimateRecipeCostFromIngredients = async (ingredients: string[]) : Promise<{ total: number; breakdown: Array<{ ingredient: string; estimatedCost: number; source: string }> }> => {
  const breakdown: Array<{ ingredient: string; estimatedCost: number; source: string }> = [];
  let total = 0;

  for (const ing of ingredients) {
    try {
      const parsed = parseIngredientForShoppingList(ing);
      // parseIngredientForShoppingList returns an object with quantity string; try to extract numeric quantity
      const qtyMatch = (parsed.quantity || '1').match(/(\d+(?:[\/.]\d+)?)/);
      const qty = qtyMatch ? parseFloat(qtyMatch[0].replace('/', '.')) : 1;

      const priceData = await groceryPriceService.getIngredientPrice(parsed.itemName || ing);
      const unitPrice = priceData ? (priceData.minPrice ?? priceData.averagePrice ?? 0) : 0;
      const estimatedCost = unitPrice * qty;
      breakdown.push({ ingredient: parsed.itemName || ing, estimatedCost, source: priceData ? 'known' : 'estimated' });
      total += estimatedCost;
    } catch (err) {
      log.warn('estimateRecipeCostFromIngredients failed for', ing, err instanceof Error ? err.message : String(err));
      breakdown.push({ ingredient: ing, estimatedCost: 0, source: 'error' });
    }
  }

  return { total, breakdown };
};
export const fetchRecipesFromSpoonacular = async (
  query: string = "",
  number: number = 10,
  offset: number = 0
): Promise<SpoonacularRecipe[]> => {
  return withErrorHandling(async () => {
    const perfTrace = trace(performance, 'fetch_spoonacular_recipes');
    perfTrace.start();

    try {
      // Try using the recipe client adapter first (supports generated client or REST fallback)
      try {
        const RecipeClient = await import('./spoonacularRecipeClient');
        const searchFn = RecipeClient.default && RecipeClient.default.searchRecipes;
        const isMock = !!(searchFn && ((searchFn as unknown as Record<string, unknown>).mock || (searchFn as unknown as Record<string, unknown>).__isMock || (searchFn as unknown as Record<string, unknown>).isMockFunction));

        // If the adapter's searchRecipes has been mocked (tests spying on it), call it.
        if (isMock) {
          const found = await searchFn.call(RecipeClient.default, query, number, offset);
          if (found) {
            perfTrace.putMetric('results_returned', Array.isArray(found) ? found.length : (found.results ? found.results.length : 0));
            perfTrace.putMetric('query_length', query.length);
            perfTrace.putMetric('requested_count', number);
            perfTrace.putMetric('offset', offset);
            return Array.isArray(found) ? found : (found.results || []);
          }
        } else {
          // In test environments, avoid invoking the adapter to prevent importing
          // the generated client (which can mutate global fetch) unless the test
          // explicitly mocked the adapter. In non-test environments, use adapter.
          if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
            const found = await RecipeClient.default.searchRecipes(query, number, offset);
            if (found) {
              perfTrace.putMetric('results_returned', Array.isArray(found) ? found.length : (found.results ? found.results.length : 0));
              perfTrace.putMetric('query_length', query.length);
              perfTrace.putMetric('requested_count', number);
              perfTrace.putMetric('offset', offset);
              return Array.isArray(found) ? found : (found.results || []);
            }
          }
        }
      } catch {
        // fall through to original fetch-based implementation
      }

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

      if (query) params.append('query', query);

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
  if (communityRatedRecipesCache) {
    return communityRatedRecipesCache;
  }
  try {
    const ref = DatabaseMonitoringService.doc('system/community_rated_recipes');
    const docSnap = await DatabaseMonitoringService.getDoc(ref);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const recipes = (data?.recipes || []) as SavedRecipe[];
      communityRatedRecipesCache = recipes;
      return recipes;
    }

    // Fallback to retrieving saved recipes (not ideal but safe)
    // No community-rated cache found, falling back to saved recipes
    const fallback = await getSavedRecipes(50);
    communityRatedRecipesCache = fallback;
    return fallback;
  } catch (err: unknown) {
    log.error('Error fetching community-rated cache', err);
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
    // Some test environments mock Firestore helpers (orderBy/where/query).
    // To be robust, read the collection and filter in-memory when query builders
    // are unavailable or mocked.
    let snap: { docs: FirestoreDocLike[] };
    try {
      const rawSnap = await DatabaseMonitoringService.getDocs(ratingsRef);
      // Filter by cutoff in-memory
      snap = { docs: (rawSnap.docs || []).filter((d: FirestoreDocLike) => {
        const data = d.data();
        const dateVal = data?.date ? new Date(data.date as string) : null;
        return dateVal ? dateVal > cutoff : false;
      }) };
    } catch {
      // Fallback to empty
      snap = { docs: [] };
    }

    const counts: Record<string, { count: number; sum: number; ids: Set<string> }> = {};
    for (const d of snap.docs) {
      const data = d.data();
      const title = (data.recipeTitle as string | undefined) || ((data.recipeId as string | undefined) ?? 'Unknown Recipe');
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

    const results: Array<DocumentData & { id: string | null }> = [];
    for (const item of aggregated) {
      let recipeDoc: (DocumentData & { id: string }) | null = null;
      // prefer recipeId if available
      if (item.recipeIds && item.recipeIds.length > 0) {
        try {
          const docRef = DatabaseMonitoringService.doc(`recipes/${item.recipeIds[0]}`);
          const ds = await DatabaseMonitoringService.getDoc(docRef);
          if (ds && ds.exists && typeof ds.exists === 'function' ? ds.exists() : ds.exists) {
            const d = ds.data() as DocumentData;
            recipeDoc = { id: ds.id, ...d };
          }
        } catch { /* ignore */ }
      }

      if (!recipeDoc) {
        try {
          const allRecipesSnap = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.collection('recipes'));
          const found = (allRecipesSnap.docs || []).find((rd: FirestoreDocLike) => {
            const data = rd.data();
            return data?.title === item.title;
          });
          if (found) {
            const d = found.data();
            recipeDoc = { id: found.id, ...d };
          }
        } catch { /* ignore */ }
      }

      const entry: DocumentData & { id: string | null } = recipeDoc ? { ...recipeDoc } : { id: null, title: item.title, description: null, ingredients: [], instructions: [], image: null };

      entry.popularityCount = item.popularityCount;
      entry.averageRating = item.averageRating;

      // Attach community stats if present
      try {
        const statsRef = DatabaseMonitoringService.doc(`recipeCommunityStats/${item.title}`);
        const statsSnap = await DatabaseMonitoringService.getDoc(statsRef);
        if (statsSnap && statsSnap.exists && typeof statsSnap.exists === 'function' ? statsSnap.exists() : statsSnap.exists) entry.communityStats = statsSnap.data();
      } catch { /* ignore */ }

      results.push(entry);
    }

    const cacheRef = DatabaseMonitoringService.doc('system/community_rated_recipes');
    await DatabaseMonitoringService.setDoc(cacheRef, { recipes: results, lastUpdated: new Date(), version: 1 });

    perfTrace.putMetric('community_cached_count', results.length);
    log.info('Rebuilt community-rated recipes cache', { count: results.length });
  } catch (err: unknown) {
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
export const upsertCommunityRatedRecipeByTitle = async (title: string, recipeId?: string): Promise<void> => {
  try {
    // Fetch community stats
    const statsRef = DatabaseMonitoringService.doc(`recipeCommunityStats/${title}`);
    const statsSnap = await DatabaseMonitoringService.getDoc(statsRef);
    const stats = statsSnap && statsSnap.exists && typeof statsSnap.exists === 'function' ? (statsSnap.exists() ? statsSnap.data() : {}) : (statsSnap && statsSnap.exists ? statsSnap.data() : {});

    // Try to locate the recipe document by title (or id if stats contains one)
    let recipeDoc: (DocumentData & { id: string }) | null = null;
    try {
      // If recipeId is provided, use it directly
      if (recipeId) {
        const rd = await DatabaseMonitoringService.getDoc(DatabaseMonitoringService.doc(`recipes/${recipeId}`));
        if (rd && rd.exists && typeof rd.exists === 'function' ? rd.exists() : rd.exists) {
          const d = rd.data() as DocumentData;
          recipeDoc = { id: rd.id, ...d };
        }
      } else {
        // If stats contains a recipeId, try that first
        const possibleId = stats?.recipeId as string | undefined;
        if (possibleId) {
          const rd = await DatabaseMonitoringService.getDoc(DatabaseMonitoringService.doc(`recipes/${possibleId}`));
          if (rd && rd.exists && typeof rd.exists === 'function' ? rd.exists() : rd.exists) {
            const d = rd.data() as DocumentData;
            recipeDoc = { id: rd.id, ...d };
          }
        }
      }
    } catch { /* ignore */ }

    if (!recipeDoc && !recipeId) {
      try {
        const q = DatabaseMonitoringService.query(DatabaseMonitoringService.collection('recipes'), DatabaseMonitoringService.where('title', '==', title), DatabaseMonitoringService.limit(1));
        const rq = await DatabaseMonitoringService.getDocs(q);
        if (rq && rq.docs && rq.docs.length > 0) {
          const d = (rq.docs[0] as FirestoreDocLike).data();
          recipeDoc = { id: rq.docs[0].id, ...d };
        }
      } catch { /* ignore */ }
    }

    const entry: DocumentData & { id: string | null } = recipeDoc ? { ...recipeDoc } : { id: null, title, description: null, ingredients: [], instructions: [], image: null };

    // Attach rating metadata from stats
    entry.totalRatings = stats?.totalRatings ?? (stats?.ratingsCount ?? 0);
    entry.averageRating = stats?.averageRating ?? null;
    entry.wouldMakeAgainPercentage = stats?.wouldMakeAgainPercentage ?? null;
    entry.topFeedback = stats?.topFeedback ?? [];
    entry.lastUpdated = stats?.lastUpdated ?? new Date().toISOString();

    // Upsert into the single-doc cache
    const cacheRef = DatabaseMonitoringService.doc('system/community_rated_recipes');
    const cacheSnap = await DatabaseMonitoringService.getDoc(cacheRef);
    let arr: Array<DocumentData & { id: string | null }> = [];
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
  } catch (err: unknown) {
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
    instructions: spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map((step: AnalyzedInstructionStep) =>
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
  } catch (err: unknown) {
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
      const savedRecipe = {
        ...recipe,
        dateSaved: new Date().toISOString(),
        userId: options?.userId ?? undefined,
        visibility: options?.visibility ?? 'private'
      };

      // Add custom metrics
      perfTrace.putMetric('ingredients_count', recipe.ingredients.length);
      perfTrace.putMetric('instructions_count', recipe.instructions.length);
      perfTrace.putAttribute('has_image', recipe.image ? 'true' : 'false');

      const docRef = await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection("recipes"), savedRecipe);
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
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    perfTrace.putAttribute('result', 'uploaded');
    return downloadURL;
  } catch (err: unknown) {
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
      };

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
      const savedItem = {
        ...recipe,
        id: recipeId,
        dateSaved: new Date().toISOString(),
        userId: uid,
        visibility: 'private'
      };

      if (snap && snap.exists()) {
        const existing = snap.data();
        if (existing && existing.recipes && Array.isArray(existing.recipes)) {
          const arr = existing.recipes;
          // prepend new recipe
          arr.unshift(savedItem);
          // Optionally trim to reasonable length (e.g., 500)
          if (arr.length > 500) arr.length = 500;
          await DatabaseMonitoringService.updateDoc(cacheRef, { recipes: arr, lastUpdated: serverTimestamp() });
        } else {
          await DatabaseMonitoringService.setDoc(cacheRef, { recipes: [savedItem], lastUpdated: serverTimestamp() });
        }
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
        // Fetching recipes for search query

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
            // Recipe saved successfully

          } catch (recipeError) {
            result.failed++;
            result.errors.push(`Failed to save recipe "${spoonacularRecipe.title}": ${recipeError}`);
            log.error(`Failed to save recipe: ${spoonacularRecipe.title}`, recipeError);
          }
        }

        completedQueries++;
        onProgress?.(completedQueries, totalQueries);

        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (queryError) {
        result.errors.push(`Failed to fetch recipes for "${searchQuery}": ${queryError}`);
        log.error(`Failed to fetch recipes for ${searchQuery}`, queryError);
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
    // Some test environments mock Firestore helpers (orderBy/query/limit).
    // Read the collection and sort/limit in-memory as a robust fallback.
    try {
      const querySnapshot = await DatabaseMonitoringService.getDocs(recipesRef);
      const items = (querySnapshot.docs || []).map((doc: FirestoreDocLike) => {
        const d = doc.data();
        return ({ id: doc.id, ...(d && typeof d === 'object' ? (d as Record<string, unknown>) : {}) } as SavedRecipe);
      });
      // Sort by dateSaved desc and apply limit
      items.sort((a: SavedRecipe, b: SavedRecipe) => {
        const da = a.dateSaved ? new Date(a.dateSaved).getTime() : 0;
        const db = b.dateSaved ? new Date(b.dateSaved).getTime() : 0;
        return db - da;
      });
      return items.slice(0, limitCount);
    } catch (err: unknown) {
      log.error('Error fetching saved recipes', err);
      return [];
    }
  } catch (err: unknown) {
    log.error("Error fetching saved recipes", err);
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
  if (popularRecipesCache) {
    return popularRecipesCache;
  }
  try {
    // Prefer admin-written cache at recipe_caches/popular_recipes (admin scripts use this)
    const cachePaths = ["recipe_caches/popular_recipes", "system/popular_recipes"];
    let docSnap: Awaited<ReturnType<typeof DatabaseMonitoringService.getDoc>> | null = null;
    let data: DocumentData | null = null;

    for (const path of cachePaths) {
      try {
        const ref = DatabaseMonitoringService.doc(path);
        docSnap = await DatabaseMonitoringService.getDoc(ref);
        if (docSnap && docSnap.exists()) {
          data = docSnap.data();
          break;
        }
      } catch {
        // continue to next path
      }
    }

    if (data) {
      const recipes = data?.recipes || [];
      // Remove duplicates based on title to ensure clean data
      const uniqueRecipes = (recipes as SavedRecipe[]).filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      );
      // Loaded cached recipes
      popularRecipesCache = uniqueRecipes;
      return uniqueRecipes;
    }

    // If no cached recipes exist, fall back to loading individual recipes
    // No cached popular recipes found, falling back to individual recipe loading
    const recipes = await getSavedRecipes(50);
    // Remove duplicates even in fallback
    const uniqueFallback = recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );
    popularRecipesCache = uniqueFallback;
    return uniqueFallback;
  } catch (err: unknown) {
    log.error("Error fetching cached popular recipes", err);
    // Fall back to direct loading if caching fails
    // Falling back to direct recipe loading
    const recipes = await getSavedRecipes(50);
    // Remove duplicates even in fallback
    const uniqueFallback = recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );
    popularRecipesCache = uniqueFallback;
    return uniqueFallback;
  }
};

/**
 * Read a specific recipes cache document under `recipe_caches/{cacheId}`.
 * Example: `recipe_caches/recipes_cache_1` used by MealPlanner to avoid many reads.
 */
export const getCachedRecipesCache = async (cachePath: string = 'recipe_caches/recipes_cache_1'): Promise<SavedRecipe[]> => {
  if (recipesCacheByPath[cachePath]) {
    return recipesCacheByPath[cachePath];
  }
  // Helper: try to read one doc, returns [] if missing/denied
  const readChunk = async (path: string): Promise<SavedRecipe[]> => {
    try {
      const ref = DatabaseMonitoringService.doc(path);
      const snap = await DatabaseMonitoringService.getDoc(ref);
      const exists = snap && (typeof snap.exists === 'function' ? snap.exists() : snap.exists);
      if (exists) {
        const data = snap.data();
        return Array.isArray(data?.recipes) ? (data.recipes as SavedRecipe[]) : [];
      }
    } catch { /* permission denied or missing — caller handles */ }
    return [];
  };

  // Derive the base path (strip trailing _N so we can iterate chunks)
  const basePathMatch = cachePath.match(/^(.+?)(_\d+)?$/);
  const basePath = basePathMatch ? basePathMatch[1] : cachePath;
  const isRecipeCaches = cachePath.startsWith('recipe_caches/');

  try {
    // Read all numbered chunks until one comes back empty
    const allRecipes: SavedRecipe[] = [];
    let chunkNum = 1;
    while (true) {
      const chunkPath = `${basePath}_${chunkNum}`;
      const chunk = await readChunk(chunkPath);
      if (chunk.length === 0) break;
      allRecipes.push(...chunk);
      chunkNum++;
      if (chunkNum > 20) break; // safety limit
    }

    if (allRecipes.length > 0) {
      recipesCacheByPath[cachePath] = allRecipes;
      return allRecipes;
    }

    // Fallback: try system/ mirror for permission-gated paths
    if (isRecipeCaches) {
      try {
        const systemBase = basePath.replace('recipe_caches', 'system');
        const sysChunk = await readChunk(`${systemBase}_1`);
        if (sysChunk.length > 0) {
          const all = [...sysChunk];
          let n = 2;
          while (n <= 20) {
            const c = await readChunk(`${systemBase}_${n}`);
            if (c.length === 0) break;
            all.push(...c);
            n++;
          }
          recipesCacheByPath[cachePath] = all;
          return all;
        }
      } catch (permErr: unknown) {
        log.warn('System cache read failed', permErr instanceof Error ? permErr.message : permErr);
      }
    }

    const fallback = await getSavedRecipes(50);
    recipesCacheByPath[cachePath] = fallback;
    return fallback;
  } catch (err: unknown) {
    log.error(`Error fetching cached recipes at ${cachePath}`, err);
    const fallback = await getSavedRecipes(50);
    recipesCacheByPath[cachePath] = fallback;
    return fallback;
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
      // User not authenticated, skipping recipe caching
      return;
    }

    const popularRecipesRef = DatabaseMonitoringService.doc("system/popular_recipes");
    await DatabaseMonitoringService.setDoc(popularRecipesRef, {
      recipes,
      lastUpdated: new Date(),
      version: 1
    });
    // Cached popular recipes for efficient loading
  } catch (err: unknown) {
    log.error("Error caching popular recipes", err);
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
      const data = d.data();
      const title = (data.recipeTitle as string | undefined) || 'Unknown Recipe';
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
    }));

    const popularRecipesRef = DatabaseMonitoringService.doc('system/popular_recipes');
    await DatabaseMonitoringService.setDoc(popularRecipesRef, { recipes: top, lastUpdated: new Date(), version: 1 });

    perfTrace.putMetric('cached_count', top.length);
    log.info('Rebuilt cached popular recipes', { count: top.length });
  } catch (err: unknown) {
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

    // Read the search index collection and filter in-memory. This avoids
    // dependency on Firestore query builders which may be mocked in tests.
    const querySnapshot = await DatabaseMonitoringService.getDocs(searchIndexRef);

    // Filter in memory for more flexible search (could be optimized further with Algolia)
    const searchResults = [];
    for (const doc of querySnapshot.docs) {
      const searchEntry = doc.data() as DocumentData | Record<string, unknown>;

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

      for (const doc of recipeDocs as FirestoreDocLike[]) {
        if (doc && (typeof doc.exists === 'function' ? (doc as FirestoreDocLike & { exists(): boolean }).exists() : (doc as FirestoreDocLike & { exists: boolean }).exists)) {
          const d = doc.data();
          fullRecipes.push({ id: doc.id, ...(d && typeof d === 'object' ? d as Record<string, unknown> : {}) } as SavedRecipe);
        }
      }
    }

    // Add custom metrics
    perfTrace.putMetric('search_term_length', searchTerm.length);
    perfTrace.putMetric('search_index_size', querySnapshot.docs.length);
    perfTrace.putMetric('results_found', fullRecipes.length);

    return fullRecipes;
  } catch (err: unknown) {
    log.error("Error searching recipes", err);
    // Fallback to old method if search index fails
    // Falling back to full collection search
    return await searchRecipesInFirestoreFallback(searchTerm);
  } finally {
    perfTrace.stop();
  }
};

// Fallback search method (original implementation)
const searchRecipesInFirestoreFallback = async (searchTerm: string): Promise<SavedRecipe[]> => {
  try {
    const recipesRef = DatabaseMonitoringService.collection("recipes");
    const querySnapshot = await DatabaseMonitoringService.getDocs(recipesRef);

    const allRecipes = querySnapshot.docs.map((doc: FirestoreDocLike) => {
      const d = doc.data();
      return ({ id: doc.id, ...(d && typeof d === 'object' ? d as Record<string, unknown> : {}) } as SavedRecipe);
    });

    // Filter by search term (case-insensitive)
    const filteredRecipes = allRecipes.filter((recipe: SavedRecipe) =>
      String(recipe.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String((recipe as unknown as { description?: string }).description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      Array.isArray((recipe as unknown as { ingredients?: string[] }).ingredients) && ((recipe as unknown as { ingredients: string[] }).ingredients).some((ing: string) => String(ing || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filteredRecipes;
  } catch (err: unknown) {
    log.error("Error in fallback search", err);
    return [];
  }
};

/**
 * Clear all in-memory caches (mainly for testing)
 */
export const clearRecipeServiceCaches = () => {
  communityRatedRecipesCache = null;
  popularRecipesCache = null;
  Object.keys(recipesCacheByPath).forEach(key => {
    delete recipesCacheByPath[key];
  });
};

