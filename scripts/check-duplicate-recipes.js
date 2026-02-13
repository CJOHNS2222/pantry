#!/usr/bin/env node

/**
 * Test script to check for duplicate recipes in savedRecipes collection
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

async function checkForDuplicates(userId) {
  console.log(`🔍 Checking for duplicate recipes for user: ${userId}`);

  const collectionPath = `users/${userId}/savedRecipes`;
  const querySnapshot = await db.collection(collectionPath).get();

  const recipes = querySnapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title,
    savedAt: doc.data().savedAt
  }));

  console.log(`📊 Total recipes found: ${recipes.length}`);

  // Group by title to find duplicates
  const titleGroups = {};
  recipes.forEach(recipe => {
    const title = recipe.title?.toLowerCase()?.trim();
    if (!titleGroups[title]) {
      titleGroups[title] = [];
    }
    titleGroups[title].push(recipe);
  });

  // Find duplicates
  const duplicates = Object.entries(titleGroups)
    .filter(([title, recipes]) => recipes.length > 1)
    .map(([title, recipes]) => ({ title, count: recipes.length, recipes }));

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate recipe titles:`);
    duplicates.forEach(({ title, count, recipes }) => {
      console.log(`  "${title}": ${count} copies`);
      recipes.forEach(recipe => {
        console.log(`    - ID: ${recipe.id}, Saved: ${recipe.savedAt?.toDate?.() || recipe.savedAt}`);
      });
    });
  } else {
    console.log('✅ No duplicate recipes found');
  }

  return duplicates;
}

async function main() {
  try {
    // You'll need to provide a user ID to test
    const userId = process.argv[2];
    if (!userId) {
      console.log('Usage: node scripts/check-duplicate-recipes.js <userId>');
      console.log('Example: node scripts/check-duplicate-recipes.js abc123');
      process.exit(1);
    }

    await checkForDuplicates(userId);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();