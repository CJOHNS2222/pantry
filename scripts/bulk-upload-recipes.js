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
import { getFirestore, collection, addDoc } from "firebase/firestore";
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

/**
 * Fetch recipes from Spoonacular API
 */
async function fetchRecipesFromSpoonacular(query = "", number = 10, offset = 0) {
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
}

/**
 * Convert Spoonacular recipe to our StructuredRecipe format
 */
function convertSpoonacularToStructured(spoonacularRecipe) {
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
  "chicken",
  "beef",
  "pasta",
  "vegetarian",
  "fish",
  "pork",
  "turkey",
  "lamb",
  "seafood",
  "salad",
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
  "snack"
];

const RECIPES_PER_QUERY = 2; // Reduced to stay within 50 requests/day limit

async function bulkUploadRecipes(searchQueries, recipesPerQuery, onProgress) {
  const result = {
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

            // Update recipe with uploaded image URL (we'll do this by saving again with the new image URL)
            const updatedRecipe = { ...structuredRecipe, image: uploadedImageUrl };
            await saveRecipeToFirestore(updatedRecipe);
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
  console.log(`📊 Will fetch ${RECIPES_PER_QUERY} recipes for each of ${SEARCH_QUERIES.length} search terms`);
  console.log(`📈 Total estimated recipes: ${SEARCH_QUERIES.length * RECIPES_PER_QUERY}`);
  console.log(`⏱️  Rate limit: 1 request/second (Spoonacular free tier)`);

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