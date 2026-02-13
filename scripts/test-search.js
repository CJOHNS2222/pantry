#!/usr/bin/env node

/**
 * Test the recipe search functionality
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
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: envVars.VITE_PROJECT_ID
});

const db = getFirestore(app);

async function testSearch(searchTerm) {
  console.log(`🔍 Testing search for: "${searchTerm}"`);

  const startTime = Date.now();

  // Use the search index
  const searchIndexRef = db.collection("recipe_search_index");
  const querySnapshot = await searchIndexRef.get();

  const searchResults = [];
  const searchTermLower = searchTerm.toLowerCase();

  for (const doc of querySnapshot.docs) {
    const searchEntry = doc.data();

    // Check if search term matches
    const matches =
      searchEntry.title?.toLowerCase().includes(searchTermLower) ||
      searchEntry.description?.toLowerCase().includes(searchTermLower) ||
      searchEntry.ingredients?.some((ing) => ing.toLowerCase().includes(searchTermLower)) ||
      searchEntry.keywords?.some((kw) => kw.includes(searchTermLower)) ||
      searchEntry.searchText?.includes(searchTermLower);

    if (matches) {
      searchResults.push(searchEntry);
    }
  }

  const searchTime = Date.now() - startTime;
  console.log(`⏱️ Search completed in ${searchTime}ms`);
  console.log(`📊 Found ${searchResults.length} matches in search index`);

  // Get full recipe details for first few matches
  if (searchResults.length > 0) {
    const sampleIds = searchResults.slice(0, 3).map(r => r.id);
    console.log(`📖 Sample recipe IDs: ${sampleIds.join(', ')}`);

    // Get one full recipe as example
    const firstRecipe = searchResults[0];
    const recipeDoc = await db.collection("recipes").doc(firstRecipe.id).get();
    if (recipeDoc.exists) {
      const recipe = recipeDoc.data();
      console.log(`🍳 Example result: "${recipe.title}"`);
    }
  }

  return searchResults.length;
}

async function runTests() {
  try {
    console.log('🧪 Testing recipe search functionality...\n');

    const tests = [
      'chicken',
      'pasta',
      'salad',
      'quick',
      'vegetarian',
      'nonexistentterm'
    ];

    for (const term of tests) {
      const results = await testSearch(term);
      console.log(`✅ "${term}": ${results} results\n`);
    }

    console.log('🎉 Search testing completed!');

  } catch (error) {
    console.error('❌ Error testing search:', error);
  }
}

runTests();