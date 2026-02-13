#!/usr/bin/env node

/**
 * Clean up duplicate recipes in savedRecipes collection
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

async function cleanupDuplicates(userId) {
  console.log('🧹 Cleaning up duplicate recipes for user:', userId);

  const collectionPath = `users/${userId}/savedRecipes`;
  const snapshot = await db.collection(collectionPath).get();

  const recipes = snapshot.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title?.toLowerCase()?.trim(),
    data: doc.data()
  }));

  console.log(`📊 Found ${recipes.length} total recipes`);

  // Group by normalized title
  const groups = {};
  recipes.forEach(recipe => {
    if (!groups[recipe.title]) groups[recipe.title] = [];
    groups[recipe.title].push(recipe);
  });

  // Find duplicates and keep only the most recent one
  const toDelete = [];
  Object.values(groups).forEach(group => {
    if (group.length > 1) {
      console.log(`🔍 Found ${group.length} copies of: "${group[0].data.title}"`);

      // Sort by savedAt timestamp, keep the most recent
      group.sort((a, b) => {
        const aTime = a.data.savedAt?.toDate?.() || new Date(a.data.savedAt || 0);
        const bTime = b.data.savedAt?.toDate?.() || new Date(b.data.savedAt || 0);
        return bTime - aTime;
      });

      // Mark older ones for deletion
      for (let i = 1; i < group.length; i++) {
        toDelete.push(group[i].id);
        console.log(`  🗑️ Will delete: ${group[i].id}`);
      }

      console.log(`  ✅ Keeping: ${group[0].id} (${group[0].data.title})`);
    }
  });

  if (toDelete.length > 0) {
    console.log(`\n🗑️ Deleting ${toDelete.length} duplicate recipes...`);

    // Delete one by one to ensure they get deleted
    for (const id of toDelete) {
      try {
        await db.collection(collectionPath).doc(id).delete();
        console.log(`✅ Deleted: ${id}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${id}:`, error);
      }
    }

    console.log('✅ Duplicates cleaned up successfully!');
  } else {
    console.log('✅ No duplicates found');
  }
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.log('Usage: node scripts/cleanup-duplicate-recipes.js <userId>');
    process.exit(1);
  }

  await cleanupDuplicates(userId);
}

main();