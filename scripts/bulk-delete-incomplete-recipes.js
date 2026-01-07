#!/usr/bin/env node

/**
 * Bulk Delete Recipes Script
 *
 * This script deletes recipes from Firestore where instructions contain "Instructions not available"
 * Usage: node scripts/bulk-delete-incomplete-recipes.js
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
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

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

/**
 * Bulk delete recipes with incomplete instructions
 */
async function bulkDeleteIncompleteRecipes() {
  try {
    console.log('🔍 Finding recipes with incomplete instructions...');

    const recipesRef = collection(db, 'recipes');
    const snapshot = await getDocs(recipesRef);

    let deletedCount = 0;
    const deletePromises = [];

    snapshot.forEach((document) => {
      const data = document.data();

      // Check if instructions contain "Instructions not available"
      if (data.instructions && Array.isArray(data.instructions)) {
        const hasIncompleteInstructions = data.instructions.some(instruction =>
          instruction.includes('Instructions not available')
        );

        if (hasIncompleteInstructions) {
          console.log(`🗑️  Deleting recipe: "${data.title}"`);
          deletePromises.push(deleteDoc(doc(db, 'recipes', document.id)));
          deletedCount++;
        }
      }
    });

    if (deletePromises.length > 0) {
      console.log(`\n🗑️  Deleting ${deletePromises.length} recipes with incomplete instructions...`);
      await Promise.all(deletePromises);
      console.log(`✅ Successfully deleted ${deletePromises.length} recipes`);
    } else {
      console.log('✅ No recipes found with incomplete instructions');
    }

    console.log(`📊 Total recipes scanned: ${snapshot.size}`);
    console.log(`📊 Recipes deleted: ${deletedCount}`);

  } catch (error) {
    console.error('❌ Error during bulk delete:', error);
    process.exit(1);
  }
}

// Run the bulk delete
bulkDeleteIncompleteRecipes();