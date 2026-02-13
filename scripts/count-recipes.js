#!/usr/bin/env node

/**
 * Quick script to count recipes in the database
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function countRecipes() {
  try {
    console.log('🔍 Checking recipe counts...');

    const recipesRef = db.collection('recipes');
    const snapshot = await recipesRef.get();
    console.log('📊 Total recipes in database:', snapshot.size);

    // Get the most recent 50 recipes
    const recentRecipes = await recipesRef.orderBy('dateSaved', 'desc').limit(50).get();
    console.log('📈 Most recent 50 recipes available:', recentRecipes.size);

    // Check current cache
    const cacheRef = db.doc('system/popular_recipes');
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      console.log('💾 Current cached recipes:', cacheData?.recipes?.length || 0);
    } else {
      console.log('💾 No cache document found');
    }

  } catch (error) {
    console.error('❌ Error counting recipes:', error);
  }
}

countRecipes();