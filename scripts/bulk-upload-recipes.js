#!/usr/bin/env node

/**
 * Bulk Recipe Upload Script
 *
 * This script fetches recipes from Spoonacular API and stores them in Firebase.
 * Usage: node scripts/bulk-upload-recipes.js
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').filter(line => line.includes('='));
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.error('Could not load .env.local file:', error.message);
}

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase config (same as in your app)
const firebaseConfig = {
  apiKey: process.env.VITE_API_KEY,
  authDomain: process.env.VITE_AUTH_DOMAIN,
  projectId: process.env.VITE_PROJECT_ID,
  storageBucket: process.env.VITE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_APP_ID,
  measurementId: process.env.VITE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const SPOONACULAR_API_KEY = process.env.VITE_SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";
const MEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1";

/**
 * Fetch recipes from TheMealDB API (primary)
 */
async function fetchRecipesFromMealDB(query = "", category = "") {
  let url = `${MEALDB_BASE_URL}/`;

  if (query) {
    url += `search.php?s=${encodeURIComponent(query)}`;
  } else if (category) {
    url += `filter.php?c=${encodeURIComponent(category)}`;
  } else {
    // Get multiple random recipes by making multiple requests
    const randomRecipes = [];
    for (let i = 0; i < 5; i++) { // Get 5 random recipes
      try {
        const randomResponse = await fetch(`${MEALDB_BASE_URL}/random.php`);
        if (randomResponse.ok) {
          const randomData = await randomResponse.json();
          if (randomData.meals && randomData.meals.length > 0) {
            randomRecipes.push(randomData.meals[0]);
          }
        }
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn("Error fetching random recipe:", error.message);
      }
    }
    return randomRecipes;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheMealDB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.meals || [];
}

/**
 * Fetch recipes from Spoonacular API (fallback)
 */
async function fetchRecipesFromSpoonacular(query = "", number = 10, offset = 0, sort = "random") {
  if (!SPOONACULAR_API_KEY) {
    throw new Error("Spoonacular API key not configured");
  }

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: number.toString(),
    offset: offset.toString(),
    addRecipeInformation: "true",
    fillIngredients: "true",
    sort: sort
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
}

/**
 * Convert Spoonacular recipe to our StructuredRecipe format
 */
function convertSpoonacularToStructured(spoonacularRecipe) {
  const description = spoonacularRecipe.summary?.replace(/<[^>]*>/g, '') || `${spoonacularRecipe.title} - A delicious recipe`;
  const instructions = spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map(step =>
    step.step
  ) || [spoonacularRecipe.instructions || "Instructions not available"];

  // Check if description matches instructions
  const instructionsText = instructions.join(' ').trim();
  const isDuplicateDescription = description === instructionsText ||
                                instructionsText.includes(description) ||
                                description.includes(instructionsText.substring(0, 100));

  return {
    title: spoonacularRecipe.title,
    description: isDuplicateDescription ? null : description,
    ingredients: spoonacularRecipe.extendedIngredients?.map(ing =>
      `${ing.amount} ${ing.unit} ${ing.name}`
    ) || [],
    instructions: instructions,
    cookTime: `${spoonacularRecipe.readyInMinutes} mins`,
    type: spoonacularRecipe.dishTypes?.[0] || "Dinner",
    image: spoonacularRecipe.image
  };
}

/**
 * Convert TheMealDB recipe to our StructuredRecipe format
 */
function convertMealDBToStructured(mealDBRecipe) {
  // Skip recipes without instructions
  if (!mealDBRecipe.strInstructions || mealDBRecipe.strInstructions.trim() === '') {
    console.log(`⏭️  Skipping "${mealDBRecipe.strMeal}" - no instructions available`);
    return null;
  }

  // Extract ingredients and measurements
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = mealDBRecipe[`strIngredient${i}`];
    const measure = mealDBRecipe[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push(`${measure} ${ingredient}`.trim());
    }
  }

  const description = mealDBRecipe.strInstructions || `${mealDBRecipe.strMeal} - A delicious recipe`;
  const instructions = [mealDBRecipe.strInstructions];

  // Check if description matches instructions (for MealDB, description is often set to instructions)
  const instructionsText = instructions.join(' ').trim();
  const isDuplicateDescription = description === instructionsText ||
                                instructionsText.includes(description) ||
                                description.includes(instructionsText.substring(0, 100));

  return {
    title: mealDBRecipe.strMeal,
    description: isDuplicateDescription ? null : description,
    ingredients: ingredients,
    instructions: instructions,
    cookTime: "30 mins", // TheMealDB doesn't provide cook time, using default
    type: mealDBRecipe.strCategory || "Dinner",
    image: mealDBRecipe.strMealThumb
  };
}

/**
 * Download and upload image to Firebase Storage
 */
async function uploadRecipeImage(imageUrl, recipeId) {
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
}

/**
 * Check if a recipe with the given title already exists in Firestore
 */
async function recipeExists(title) {
  try {
    const q = query(collection(db, "recipes"), where("title", "==", title));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking if recipe exists:", error);
    return false; // If we can't check, assume it doesn't exist to avoid blocking
  }
}

/**
 * Save recipe to Firestore
 */
async function saveRecipeToFirestore(recipe) {
  try {
    const savedRecipe = {
      ...recipe,
      dateSaved: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, "recipes"), savedRecipe);
    return docRef.id;
  } catch (error) {
    console.error("Error saving recipe to Firestore:", error);
    throw error;
  }
}

const SEARCH_QUERIES = [
  // Basic proteins
  "soup",
  "stew",
  "curry",
  "stir fry",
  "grilled",
  "baked",
  "roasted",
  "slow cooker",
  "instant pot",
  "air fryer",
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snack",
  // More specific combinations
  "chicken breast",
  "ground beef",
  "salmon",
  "shrimp",
  "tofu",
  "quinoa",
  "rice",
  "potatoes",
  "pasta primavera",
  "beef stew",
  "chicken curry",
  "fish tacos",
  "vegetable stir fry",
  "grilled vegetables",
  "baked chicken",
  "roasted vegetables",
  "slow cooker chili",
  "instant pot rice",
  "air fryer wings",
  "breakfast burrito",
  "brunch casserole",
  "lunch salad",
  "dinner casserole",
  "healthy snack",
  // Dietary variations
  "keto chicken",
  "gluten free pasta",
  "low carb dinner",
  "high protein breakfast",
  "mediterranean salad",
  "asian stir fry",
  "mexican beef",
  "italian pasta",
  "french roasted",
  "thai curry"
];

const SORT_OPTIONS = ["random", "popularity", "time", "calories", "protein", "fat", "carbs"];

const RECIPES_PER_QUERY = 1; // Reduced to get more variety from different queries

async function bulkUploadRecipes(searchQueries, recipesPerQuery, onProgress) {
  const result = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  const totalQueries = searchQueries.length;
  let completedQueries = 0;

  for (const searchQuery of searchQueries) {
    try {
      console.log(`Fetching recipes for: ${searchQuery}`);

      let recipes = [];
      let usedMealDB = false;

      // Try TheMealDB first (free, no limits)
      try {
        console.log(`🔍 Trying TheMealDB for "${searchQuery}"...`);
        const mealDBRecipes = await fetchRecipesFromMealDB(searchQuery);
        if (mealDBRecipes.length > 0) {
          recipes = mealDBRecipes;
          usedMealDB = true;
          console.log(`✅ Found ${mealDBRecipes.length} recipes from TheMealDB`);
        } else {
          console.log(`⚠️  No recipes found in TheMealDB for "${searchQuery}", trying Spoonacular...`);
        }
      } catch (mealDBError) {
        console.log(`⚠️  TheMealDB failed for "${searchQuery}": ${mealDBError.message}, trying Spoonacular...`);
      }

      // Fall back to Spoonacular if TheMealDB didn't work or returned no results
      if (recipes.length === 0 && SPOONACULAR_API_KEY) {
        try {
          const sortOption = SORT_OPTIONS[Math.floor(Math.random() * SORT_OPTIONS.length)];
          console.log(`🔍 Falling back to Spoonacular for "${searchQuery}"...`);
          const spoonacularRecipes = await fetchRecipesFromSpoonacular(searchQuery, recipesPerQuery, 0, sortOption);
          recipes = spoonacularRecipes;
          console.log(`✅ Found ${spoonacularRecipes.length} recipes from Spoonacular`);
        } catch (spoonacularError) {
          console.log(`❌ Spoonacular also failed for "${searchQuery}": ${spoonacularError.message}`);
          completedQueries++;
          onProgress?.(completedQueries, totalQueries);
          continue;
        }
      } else if (recipes.length === 0) {
        console.log(`❌ No API available for "${searchQuery}" (no Spoonacular key)`);
        completedQueries++;
        onProgress?.(completedQueries, totalQueries);
        continue;
      }

      for (const recipe of recipes) {
        try {
          // Convert to our format based on API used
          const structuredRecipe = usedMealDB
            ? convertMealDBToStructured(recipe)
            : convertSpoonacularToStructured(recipe);

          // Skip if conversion returned null (no instructions)
          if (!structuredRecipe) {
            result.skipped++;
            continue;
          }

          // Check if recipe already exists
          const exists = await recipeExists(structuredRecipe.title);
          if (exists) {
            console.log(`⏭️  Skipping duplicate recipe: ${structuredRecipe.title}`);
            result.skipped++;
            continue;
          }

          // Save to Firestore first to get ID
          const recipeId = await saveRecipeToFirestore(structuredRecipe);

          // Upload image if available
          if (structuredRecipe.image) {
            const uploadedImageUrl = await uploadRecipeImage(structuredRecipe.image, recipeId);

            // Update recipe with uploaded image URL (we'll do this by saving again with the new image URL)
            const updatedRecipe = { ...structuredRecipe, image: uploadedImageUrl };
            await saveRecipeToFirestore(updatedRecipe);
          }

          result.success++;
          console.log(`✅ Saved recipe: ${structuredRecipe.title} (${usedMealDB ? 'MealDB' : 'Spoonacular'})`);

        } catch (recipeError) {
          result.failed++;
          const recipeTitle = usedMealDB ? recipe.strMeal : recipe.title;
          result.errors.push(`Failed to save recipe "${recipeTitle}": ${recipeError}`);
          console.error(`❌ Failed to save recipe:`, recipeError);
        }
      }

      completedQueries++;
      onProgress?.(completedQueries, totalQueries);

      // Small delay to respect API rate limits (1 request/second for free tier)
      await new Promise(resolve => setTimeout(resolve, 1100));

    } catch (queryError) {
      result.errors.push(`Failed to fetch recipes for "${searchQuery}": ${queryError}`);
      console.error(`Failed to fetch recipes for ${searchQuery}:`, queryError);
      completedQueries++;
      onProgress?.(completedQueries, totalQueries);
    }
  }

  return result;
}

async function main() {
  console.log('🚀 Starting bulk recipe upload...');
  console.log(`📊 Will fetch up to ${RECIPES_PER_QUERY} recipes for each of ${SEARCH_QUERIES.length} search terms`);
  console.log(`📈 Total estimated recipes: up to ${SEARCH_QUERIES.length * RECIPES_PER_QUERY} (may be less due to duplicates)`);
  console.log(`🔀 Using TheMealDB (free) as primary, Spoonacular as fallback`);
  console.log(`⏱️  Rate limit: None for MealDB, 1 request/second for Spoonacular`);

  const startTime = Date.now();

  try {
    const result = await bulkUploadRecipes(
      SEARCH_QUERIES,
      RECIPES_PER_QUERY,
      (completed, total) => {
        const percentage = Math.round((completed / total) * 100);
        console.log(`📋 Progress: ${completed}/${total} queries completed (${percentage}%)`);
      }
    );

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n✅ Bulk upload completed!');
    console.log(`📊 Results:`);
    console.log(`   ✅ Successful: ${result.success}`);
    console.log(`   ⏭️  Skipped (duplicates): ${result.skipped}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log(`   ⏱️  Duration: ${duration} seconds`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('\n🎉 Recipe database populated successfully!');

  } catch (error) {
    console.error('❌ Bulk upload failed:', error);
    process.exit(1);
  }
}

// Check if Spoonacular API key is configured
if (!process.env.VITE_SPOONACULAR_API_KEY) {
  console.error('❌ VITE_SPOONACULAR_API_KEY environment variable not set');
  console.log('Please add your Spoonacular API key to your .env.local file:');
  console.log('VITE_SPOONACULAR_API_KEY=your_api_key_here');
  console.log('Get your free API key at: https://spoonacular.com/food-api');
  process.exit(1);
}

main().catch(console.error);