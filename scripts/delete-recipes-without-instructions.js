#!/usr/bin/env node

/**
 * Delete Recipes Without Instructions Script
 *
 * This script deletes recipes from Firestore that don't have valid instructions.
 * A recipe is considered to lack instructions if:
 * - The 'instructions' field is missing
 * - The 'instructions' field is not an array
 * - The 'instructions' array is empty
 * - The 'instructions' array contains only empty strings
 * - The 'instructions' array contains only "Instructions not available"
 *
 * Usage: node scripts/delete-recipes-without-instructions.js
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

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'firebase-service-account.json'), 'utf8'));
} catch {
  console.error('❌ firebase-service-account.json not found');
  process.exit(1);
}

const projectId = process.env.VITE_PROJECT_ID;
if (!projectId) {
  console.error('❌ VITE_PROJECT_ID not found in .env.local');
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore(app);

/**
 * Check if a recipe has valid instructions
 * @param {any} instructions - The instructions field from the recipe
 * @returns {boolean} - True if instructions are valid, false otherwise
 */
function hasValidInstructions(instructions) {
  // Missing or not an array
  if (!Array.isArray(instructions)) {
    return false;
  }

  // Empty array
  if (instructions.length === 0) {
    return false;
  }

  // Check if all instructions are empty strings or "Instructions not available"
  const hasRealInstructions = instructions.some(instruction => {
    if (typeof instruction !== 'string') return false;
    const trimmed = instruction.trim();
    if (trimmed === '') return false;
    if (trimmed.toLowerCase().includes('instructions not available')) return false;
    return true;
  });

  return hasRealInstructions;
}

/**
 * Bulk delete recipes without valid instructions
 */
async function deleteRecipesWithoutInstructions() {
  try {
    console.log('🔍 Finding recipes without valid instructions...');

    const recipesRef = db.collection('recipes');
    const snapshot = await recipesRef.get();

    console.log(`📦 Found ${snapshot.size} total recipes`);

    const recipesToDelete = [];

    snapshot.forEach((document) => {
      const data = document.data();
      const instructions = data.instructions;

      if (!hasValidInstructions(instructions)) {
        const title = data.title || 'Untitled';
        recipesToDelete.push({ id: document.id, title });
      }
    });

    console.log(`🗑️  Found ${recipesToDelete.length} recipes without valid instructions:`);

    if (recipesToDelete.length === 0) {
      console.log('✅ No recipes to delete!');
      return;
    }

    // Show first 10 recipes that will be deleted
    recipesToDelete.slice(0, 10).forEach((recipe, index) => {
      console.log(`   ${index + 1}. "${recipe.title}" (${recipe.id})`);
    });

    if (recipesToDelete.length > 10) {
      console.log(`   ... and ${recipesToDelete.length - 10} more`);
    }

    console.log('\n⚠️  This will PERMANENTLY DELETE these recipes from Firestore!');
    console.log('Press Ctrl+C within 10 seconds to cancel...\n');

    // Wait 10 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Batch delete in groups of 499 (Firestore limit is 500)
    let deleted = 0;
    for (let i = 0; i < recipesToDelete.length; i += 499) {
      const batchDocs = recipesToDelete.slice(i, i + 499);
      const batch = db.batch();

      for (const recipe of batchDocs) {
        batch.delete(db.collection('recipes').doc(recipe.id));
      }

      await batch.commit();
      deleted += batchDocs.length;
      console.log(`✅ Batch committed (${batchDocs.length} recipes, ${deleted}/${recipesToDelete.length} total)`);
    }

    console.log(`\n🎉 Done! Deleted ${deleted} recipes without valid instructions.`);
    console.log('📋 Now run: node scripts/rebuild-recipes-cache.js');

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  }
}

// Run the deletion
deleteRecipesWithoutInstructions();
