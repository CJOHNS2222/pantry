#!/usr/bin/env node

/**
 * Clean Duplicate Descriptions Script
 *
 * This script checks recipes where description matches instructions and removes duplicate descriptions
 * Usage: node scripts/clean-duplicate-descriptions.js
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
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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
 * Clean recipes where description duplicates instructions
 */
async function cleanDuplicateDescriptions() {
  try {
    console.log('🔍 Finding recipes with duplicate descriptions...');

    const recipesRef = collection(db, 'recipes');
    const snapshot = await getDocs(recipesRef);

    let cleanedCount = 0;
    const updatePromises = [];

    snapshot.forEach((document) => {
      const data = document.data();

      // Check if description exists and instructions exist
      if (data.description && data.instructions && Array.isArray(data.instructions)) {
        const descriptionText = data.description.trim();
        const instructionsText = data.instructions.join(' ').trim();

        // Check if description matches instructions (exact match or very similar)
        const isDuplicate = descriptionText === instructionsText ||
                           instructionsText.includes(descriptionText) ||
                           descriptionText.includes(instructionsText.substring(0, 100)); // First 100 chars

        if (isDuplicate) {
          console.log(`🧹 Cleaning duplicate description: "${data.title}"`);
          updatePromises.push(updateDoc(doc(db, 'recipes', document.id), {
            description: null // Remove the description field
          }));
          cleanedCount++;
        }
      }
    });

    if (updatePromises.length > 0) {
      console.log(`\n🧹 Cleaning ${updatePromises.length} recipes with duplicate descriptions...`);
      await Promise.all(updatePromises);
      console.log(`✅ Successfully cleaned ${updatePromises.length} recipes`);
    } else {
      console.log('✅ No recipes found with duplicate descriptions');
    }

    console.log(`📊 Total recipes scanned: ${snapshot.size}`);
    console.log(`📊 Recipes cleaned: ${cleanedCount}`);

  } catch (error) {
    console.error('❌ Error during cleaning:', error);
    process.exit(1);
  }
}

// Run the cleaning script
cleanDuplicateDescriptions();