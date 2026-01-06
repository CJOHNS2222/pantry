import { collection, addDoc, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";
import { StructuredRecipe, SavedRecipe } from "../types";

const SPOONACULAR_API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";

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
  if (!SPOONACULAR_API_KEY) {
    throw new Error("Spoonacular API key not configured");
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

  const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
};

/**
 * Convert Spoonacular recipe to our StructuredRecipe format
 */
export const convertSpoonacularToStructured = (spoonacularRecipe: SpoonacularRecipe): StructuredRecipe => {
  return {
    title: spoonacularRecipe.title,
    description: spoonacularRecipe.summary?.replace(/<[^>]*>/g, '') || `${spoonacularRecipe.title} - A delicious recipe`,
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
  try {
    // Download image from Spoonacular
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const blob = await response.blob();

    // Upload to Firebase Storage
    const storageRef = ref(storage, `recipes/${recipeId}.jpg`);
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading recipe image:", error);
    return imageUrl; // Return original URL if upload fails
  }
};

/**
 * Save recipe to Firestore
 */
export const saveRecipeToFirestore = async (recipe: StructuredRecipe): Promise<string> => {
  try {
    const savedRecipe: Omit<SavedRecipe, 'id'> = {
      ...recipe,
      dateSaved: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, "recipes"), savedRecipe);
    return docRef.id;
  } catch (error) {
    console.error("Error saving recipe to Firestore:", error);
    throw error;
  }
};

/**
 * Bulk upload recipes from Spoonacular
 */
export const bulkUploadRecipes = async (
  searchQueries: string[] = ["chicken", "beef", "pasta", "vegetarian", "dessert"],
  recipesPerQuery: number = 10,
  onProgress?: (completed: number, total: number) => void
): Promise<BulkUploadResult> => {
  const result: BulkUploadResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  const totalQueries = searchQueries.length;
  let completedQueries = 0;

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

  return result;
};

/**
 * Get all saved recipes from Firestore
 */
export const getSavedRecipes = async (): Promise<SavedRecipe[]> => {
  try {
    const q = query(collection(db, "recipes"), orderBy("dateSaved", "desc"));
    const querySnapshot = await getDocs(q);

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
 * Search recipes in Firestore
 */
export const searchRecipesInFirestore = async (searchTerm: string): Promise<SavedRecipe[]> => {
  try {
    // Note: Firestore doesn't support full-text search natively
    // This is a simple implementation - you might want to use Algolia or Elastic Search for better search
    const q = query(collection(db, "recipes"));
    const querySnapshot = await getDocs(q);

    const allRecipes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SavedRecipe));

    // Filter by search term (case-insensitive)
    return allRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.ingredients.some(ing => ing.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  } catch (error) {
    console.error("Error searching recipes:", error);
    return [];
  }
};