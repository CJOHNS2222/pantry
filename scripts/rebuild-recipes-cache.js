#!/usr/bin/env node

/**
 * Script to rebuild the recipes cache with complete recipe data including images
 * Run this to fix missing images in recipe_caches/recipes_cache_1
 *
 * Usage: node scripts/rebuild-recipes-cache.js
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

// Prefer Application Default Credentials if set, otherwise load service account
let app;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('ℹ️ Using GOOGLE_APPLICATION_CREDENTIALS (Application Default Credentials)');
    app = initializeApp({ projectId: envVars.VITE_PROJECT_ID });
  } else {
    // Check for service account key file in project root
    const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      console.log('✅ Found Firebase service account key');
    } catch (error) {
      console.error('❌ Could not load firebase-service-account.json and GOOGLE_APPLICATION_CREDENTIALS is not set');
      console.error('Either set GOOGLE_APPLICATION_CREDENTIALS or place a firebase-service-account.json in the project root');
      process.exit(1);
    }

    app = initializeApp({ credential: cert(serviceAccount), projectId: envVars.VITE_PROJECT_ID });
  }
} catch (initErr) {
  console.error('❌ Failed to initialize Firebase Admin:', initErr.message || initErr);
  process.exit(1);
}

const db = getFirestore(app);

// Get all saved recipes from the recipes collection (with images)
async function getAllSavedRecipes(limitCount = 1000) {
  try {
    console.log(`📥 Fetching up to ${limitCount} recipes from Firestore...`);
    const recipesRef = db.collection("recipes");
    const snapshot = await recipesRef
      .orderBy("dateSaved", "desc")
      .limit(limitCount)
      .get();

    const recipes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Loaded ${recipes.length} recipes from Firestore`);
    return recipes;
  } catch (error) {
    console.error("❌ Error fetching saved recipes:", error);
    return [];
  }
}

const CHUNK_SIZE = 400; // Firestore 1MB doc limit — keep well under it

// Rebuild the recipes cache with complete data, split into chunks if needed
async function rebuildRecipesCache(recipes) {
  try {
    console.log(`💾 Rebuilding recipes cache with ${recipes.length} recipes...`);

    const withImages = recipes.filter(r => r.image).length;
    console.log(`📸 ${withImages}/${recipes.length} recipes have images`);

    const chunks = [];
    for (let i = 0; i < recipes.length; i += CHUNK_SIZE) {
      chunks.push(recipes.slice(i, i + CHUNK_SIZE));
    }

    const lastUpdated = new Date();
    for (let i = 0; i < chunks.length; i++) {
      const chunkNum = i + 1;
      const docPath = `recipe_caches/recipes_cache_${chunkNum}`;
      await db.doc(docPath).set({
        recipes: chunks[i],
        lastUpdated,
        version: 3,
        totalRecipes: recipes.length,
        chunkIndex: chunkNum,
        totalChunks: chunks.length,
        recipesWithImages: withImages
      });
      console.log(`✅ Wrote chunk ${chunkNum}/${chunks.length} (${chunks[i].length} recipes) → ${docPath}`);
    }

    console.log(`✅ Successfully rebuilt recipes cache (${chunks.length} chunk(s), ${recipes.length} total)`);
    console.log(`   - Recipes with images: ${withImages}`);
    console.log(`   - Last updated: ${lastUpdated.toISOString()}`);

  } catch (error) {
    console.error("❌ Error rebuilding recipes cache:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting recipes cache rebuild...\n');

    // Get all recipes with complete data
    const recipes = await getAllSavedRecipes();

    if (recipes.length === 0) {
      console.log('⚠️ No recipes found in database. Nothing to cache.');
      return;
    }

    // Rebuild the cache
    await rebuildRecipesCache(recipes);

    console.log('\n🎉 Recipes cache rebuild completed successfully!');
    console.log('The MealPlanner should now show images for cached recipes.');

  } catch (error) {
    console.error('\n💥 Failed to rebuild recipes cache:', error);
    process.exit(1);
  }
}

main();