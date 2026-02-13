#!/usr/bin/env node

/**
 * Test manual deletion of a duplicate recipe
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

async function testDelete() {
  const userId = 'kBAmQpY9PVYnKDRuWy4TazyWokF2';
  const docId = 'cVhaQb0f1aIuDvV65u0s'; // The remaining duplicate
  const collectionPath = `users/${userId}/savedRecipes`;

  console.log('🧪 Testing manual deletion...');
  console.log('Document ID:', docId);
  console.log('Collection:', collectionPath);

  try {
    // Check if document exists first
    const docRef = db.collection(collectionPath).doc(docId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      console.log('📄 Document exists, deleting...');
      await docRef.delete();
      console.log('✅ Delete successful');

      // Verify deletion
      const verifySnap = await docRef.get();
      if (!verifySnap.exists) {
        console.log('✅ Verified: Document no longer exists');
      } else {
        console.log('❌ Verification failed: Document still exists');
      }
    } else {
      console.log('❌ Document does not exist');
    }
  } catch (error) {
    console.error('❌ Delete failed:', error);
  }

  // List all remaining documents
  console.log('\n📊 Remaining documents:');
  const snapshot = await db.collection(collectionPath).get();
  console.log(`Found ${snapshot.size} documents:`);
  snapshot.docs.forEach(doc => {
    console.log(`- ${doc.id}: "${doc.data().title}"`);
  });
}

testDelete();