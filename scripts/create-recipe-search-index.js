#!/usr/bin/env node

/**
 * Create a search index for recipes to enable efficient searching
 * This creates a separate collection with searchable fields only
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
  process.exit(1);
}

const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  console.log('✅ Found Firebase service account key');
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: envVars.VITE_PROJECT_ID
});

const db = getFirestore(app);

// Create search index entry for a recipe
function createSearchIndexEntry(recipe) {
  return {
    id: recipe.id,
    title: recipe.title || '',
    description: recipe.description || '',
    ingredients: recipe.ingredients || [],
    cookTime: recipe.cookTime || '',
    type: recipe.type || '',
    dateSaved: recipe.dateSaved || '',
    // Create searchable text fields
    searchText: [
      recipe.title || '',
      recipe.description || '',
      ...(recipe.ingredients || [])
    ].join(' ').toLowerCase(),
    // Keywords for better search
    keywords: extractKeywords(recipe)
  };
}

// Extract keywords from recipe for better search matching
function extractKeywords(recipe) {
  const keywords = new Set();

  // Add title words
  if (recipe.title) {
    recipe.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }

  // Add ingredient words
  if (recipe.ingredients) {
    recipe.ingredients.forEach(ingredient => {
      ingredient.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 2) keywords.add(word);
      });
    });
  }

  // Add type/category
  if (recipe.type) {
    keywords.add(recipe.type.toLowerCase());
  }

  return Array.from(keywords);
}

async function createSearchIndex() {
  try {
    console.log('🔍 Creating recipe search index...');

    // Get all recipes
    const recipesRef = db.collection("recipes");
    const snapshot = await recipesRef.get();

    console.log(`📊 Found ${snapshot.docs.length} recipes to index`);

    let batch = db.batch();
    let indexedCount = 0;

    for (const doc of snapshot.docs) {
      const recipe = { id: doc.id, ...doc.data() };
      const searchEntry = createSearchIndexEntry(recipe);

      const searchDocRef = db.collection("recipe_search_index").doc(recipe.id);
      batch.set(searchDocRef, searchEntry);
      indexedCount++;

      // Commit in batches of 500 (Firestore limit)
      if (indexedCount % 500 === 0) {
        await batch.commit();
        console.log(`✅ Indexed ${indexedCount} recipes...`);
        // Start new batch
        batch = db.batch();
      }
    }

    // Commit remaining
    if (indexedCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`✅ Successfully created search index for ${indexedCount} recipes!`);
    console.log('Search operations will now be much faster.');

  } catch (error) {
    console.error('❌ Error creating search index:', error);
  }
}

createSearchIndex();