#!/usr/bin/env node

/**
 * Check current recipes in database
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

async function checkRecipes() {
  const userId = 'kBAmQpY9PVYnKDRuWy4TazyWokF2';
  const collectionPath = `users/${userId}/savedRecipes`;
  const snapshot = await db.collection(collectionPath).get();

  console.log(`📊 Found ${snapshot.size} recipes in database:`);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ${doc.id}: "${data.title}"`);
  });
}

checkRecipes();