#!/usr/bin/env node

/**
 * Script to cache popular recipes for efficient loading
 * Run this once to populate the cached recipes document
 *
 * Usage: node scripts/cache-popular-recipes.js
 * Requires .env.local file in project root with Firebase config
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env.local');

let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        envVars[key.trim()] = value.slice(1, -1);
      } else {
        envVars[key.trim()] = value;
      }
    }
  });
} catch (error) {
  console.error('❌ Could not load .env.local file:', error.message);
  console.error('Please ensure .env.local exists in the project root with Firebase configuration.');
  process.exit(1);
}

// Check for service account key
const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  console.log('✅ Found Firebase service account key');
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json');
  console.error('Please ensure you have a Firebase service account key file for admin access.');
  console.error('Download it from: Firebase Console > Project Settings > Service Accounts > Generate new private key');
  process.exit(1);
}

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: envVars.VITE_PROJECT_ID
});

const db = getFirestore(app);

// Get saved recipes from the recipes collection
async function getSavedRecipes(limitCount = 50) {
  try {
    const recipesRef = db.collection("recipes");
    const snapshot = await recipesRef.orderBy("dateSaved", "desc").limit(limitCount).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching saved recipes:", error);
    return [];
  }
}

// Cache popular recipes in the system collection
async function cachePopularRecipes(recipes) {
  try {
    const popularRecipesRef = db.doc("system/popular_recipes");
    await popularRecipesRef.set({
      recipes,
      lastUpdated: new Date(),
      version: 1
    });
    console.log(`💾 Cached ${recipes.length} recipes for future fast loading`);
  } catch (error) {
    console.error("❌ Error caching popular recipes:", error);
    throw error;
  }
}

// Get cached popular recipes
async function getCachedPopularRecipes() {
  try {
    const popularRecipesRef = db.doc("system/popular_recipes");
    const docSnap = await popularRecipesRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const recipes = data?.recipes || [];
      // Remove duplicates based on title to ensure clean data
      const uniqueRecipes = recipes.filter((recipe, index, self) =>
        index === self.findIndex(r => r.title === recipe.title)
      );
      console.log(`✅ Loaded ${uniqueRecipes.length} cached recipes (1 database read)`);
      return uniqueRecipes;
    }

    // If no cached recipes exist, fall back to loading and caching recipes
    console.log("📥 No cached popular recipes found, loading and caching 50 recipes...");
    const recipes = await getSavedRecipes(50);
    // Remove duplicates before caching
    const uniqueRecipes = recipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    );

    // Try to cache for future use
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
}

async function cachePopularRecipesScript() {
  try {
    console.log('🔐 Connected to Firebase with admin credentials');

    console.log('Checking for existing cached recipes...');

    // First, try to delete any existing cache
    try {
      const cacheRef = db.doc("system/popular_recipes");
      await cacheRef.delete();
      console.log('🗑️ Deleted existing cache (if it existed)');
    } catch (deleteError) {
      console.log('ℹ️ No existing cache to delete or delete failed (this is normal)');
    }

    console.log('Loading and caching popular recipes...');

    // Load enough recipes to get 50 unique ones
    let allRecipes = [];
    let lastDoc = null;
    const batchSize = 50;
    const targetUnique = 50;

    while (allRecipes.length < targetUnique * 2) { // Fetch up to 100 to ensure we get 50 unique
      let query = db.collection("recipes").orderBy("dateSaved", "desc").limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.docs.length === 0) break;

      const batchRecipes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      allRecipes = allRecipes.concat(batchRecipes);
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Check if we have enough unique recipes
      const uniqueTitles = new Set(allRecipes.map(r => r.title));
      if (uniqueTitles.size >= targetUnique) break;
    }

    // Remove duplicates before caching
    const uniqueRecipes = allRecipes.filter((recipe, index, self) =>
      index === self.findIndex(r => r.title === recipe.title)
    ).slice(0, targetUnique); // Take only the first 50 unique

    console.log(`Loaded ${uniqueRecipes.length} unique recipes from database. Caching them...`);
    await cachePopularRecipes(uniqueRecipes);
    await cachePopularRecipes(uniqueRecipes);

    console.log(`✅ Successfully cached ${uniqueRecipes.length} popular recipes!`);
    console.log('The RecipeFinder will now load recipes with just 1 database read instead of 50+.');

  } catch (error) {
    console.error('❌ Error caching popular recipes:', error);
    console.error('Make sure you have the correct Firebase service account key and permissions.');
  }
}

cachePopularRecipesScript();