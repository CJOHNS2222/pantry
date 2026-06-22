#!/usr/bin/env node

/**
 * Import Enriched Recipes
 * 
 * Reads the reconstructed recipe data from scripts/test-data/enriched_recipes.json,
 * checks for duplicates, and uploads them to Firebase Firestore and Search Index.
 * 
 * This script does not call any AI/Gemini endpoints, so it doesn't consume your API key quota.
 * 
 * Usage: node scripts/import-enriched-recipes.js
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables from .env.local
const envPath = join(projectRoot, '.env.local');
let envVars = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
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
  console.warn('⚠️ Could not load .env.local file:', error.message);
}

const projectId = envVars.VITE_PROJECT_ID || process.env.VITE_PROJECT_ID;

// Load service account key
const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json:', error.message);
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: projectId
});

const db = getFirestore(app);

const jsonPath = join(projectRoot, 'scripts', 'test-data', 'enriched_recipes.json');

function extractKeywords(recipe) {
  const keywords = new Set();
  if (recipe.title) {
    recipe.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }
  if (recipe.ingredients) {
    recipe.ingredients.forEach(ingredient => {
      ingredient.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 2) keywords.add(word);
      });
    });
  }
  if (recipe.type) {
    keywords.add(recipe.type.toLowerCase());
  }
  return Array.from(keywords);
}

async function main() {
  console.log('🚀 Starting Enriched Recipe Importer...');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Enriched recipes JSON not found at: ${jsonPath}`);
    process.exit(1);
  }

  const recipes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${recipes.length} recipes from JSON file.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    console.log(`\n[${i + 1}/${recipes.length}] Processing: "${r.title}"`);

    try {
      // 1. Check duplicate
      const existing = await db.collection('recipes').where('title', '==', r.title).get();
      if (!existing.empty) {
        console.log(`⏭️  Skipping duplicate recipe: "${r.title}"`);
        skipCount++;
        continue;
      }

      // 2. Prepare Recipe Document
      const recipeDocRef = db.collection('recipes').doc();
      const recipeId = recipeDocRef.id;

      const recipeObj = {
        title: r.title,
        description: r.description || null,
        ingredients: r.ingredients,
        instructions: r.instructions,
        cookTime: r.cookTime || '30 mins',
        prepTime: r.prepTime || null,
        servings: r.servings || null,
        type: r.category || 'Dinner',
        tags: r.tags || [],
        image: r.imageUrl || null,
        source: 'Allrecipes',
        sourceUrl: r.sourceUrl || '',
        dateSaved: new Date().toISOString()
      };

      if (r.calories !== null && r.calories !== undefined) {
        recipeObj.nutrition = {
          calories: r.calories
        };
      }

      // Save to recipes collection
      await recipeDocRef.set(recipeObj);

      // 3. Prepare and Save Search Index Document
      const searchEntry = {
        id: recipeId,
        title: r.title,
        description: r.description || '',
        ingredients: r.ingredients,
        cookTime: r.cookTime || '30 mins',
        type: r.category || 'Dinner',
        dateSaved: recipeObj.dateSaved,
        searchText: [
          r.title,
          r.description || '',
          ...r.ingredients
        ].join(' ').toLowerCase(),
        keywords: extractKeywords(recipeObj)
      };

      await db.collection('recipe_search_index').doc(recipeId).set(searchEntry);

      console.log(`✅ Successfully imported and indexed: "${r.title}"`);
      successCount++;

    } catch (e) {
      console.error(`❌ Failed to import recipe "${r.title}":`, e.message);
      failCount++;
    }
  }

  console.log(`\n=========================================`);
  console.log(`🏁 Enriched Recipe Import Completed!`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`=========================================`);

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error in importer script:', err);
  process.exit(1);
});
