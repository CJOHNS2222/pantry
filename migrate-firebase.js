import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Old project configuration
const oldServiceAccount = {
  type: "service_account",
  project_id: "gen-lang-client-0893655267",
  // You'll need to add the service account key for the old project
  // Download from Firebase Console > Project Settings > Service Accounts
};

const oldConfig = {
  apiKey: "AIzaSyBqJB2SjnyoKvNPx5jZbGD96DnqMLrVsOc",
  authDomain: "gen-lang-client-0893655267.firebaseapp.com",
  projectId: "gen-lang-client-0893655267",
  storageBucket: "gen-lang-client-0893655267.appspot.com",
  messagingSenderId: "651327126572",
  appId: "1:651327126572:web:2ab6f25e9b9bd0caff6589"
};

// New project configuration
const newServiceAccount = {
  type: "service_account",
  project_id: "ornate-compass-478504-e1",
  // You'll need to add the service account key for the new project
  // Download from Firebase Console > Project Settings > Service Accounts
};

const newConfig = {
  apiKey: "AIzaSyCKpvxjip_ojS0ZP6Yu_II-GQcldTD84Kg",
  authDomain: "ornate-compass-478504-e1.firebaseapp.com",
  projectId: "ornate-compass-478504-e1",
  storageBucket: "ornate-compass-478504-e1.firebasestorage.app",
  messagingSenderId: "13848266518",
  appId: "1:13848266518:web:e2702950b9ef10bcc8b237"
};

async function migrateFirestoreData() {
  console.log('🚀 Starting Firestore data migration...');

  try {
    // Initialize old project
    const oldApp = admin.initializeApp({
      credential: admin.credential.cert(oldServiceAccount),
      projectId: oldConfig.projectId
    }, 'old-project');

    const oldDb = admin.firestore(oldApp);

    // Initialize new project
    const newApp = admin.initializeApp({
      credential: admin.credential.cert(newServiceAccount),
      projectId: newConfig.projectId
    }, 'new-project');

    const newDb = admin.firestore(newApp);

    // Collections to migrate
    const collections = [
      'households',
      'inventory',
      'recipes',
      'shoppingLists',
      'mealPlans',
      'users',
      'notifications'
    ];

    for (const collectionName of collections) {
      console.log(`📋 Migrating collection: ${collectionName}`);

      const snapshot = await oldDb.collection(collectionName).get();

      if (snapshot.empty) {
        console.log(`   ⚠️  Collection ${collectionName} is empty, skipping...`);
        continue;
      }

      const batch = newDb.batch();
      let batchCount = 0;
      let totalDocs = 0;

      for (const doc of snapshot.docs) {
        const docRef = newDb.collection(collectionName).doc(doc.id);
        batch.set(docRef, doc.data());
        batchCount++;
        totalDocs++;

        // Firestore batch limit is 500 operations
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      }

      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Committed final batch of ${batchCount} documents`);
      }

      console.log(`   🎉 Migrated ${totalDocs} documents from ${collectionName}`);
    }

    console.log('✅ Firestore data migration completed!');

    // Cleanup
    await oldApp.delete();
    await newApp.delete();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function migrateAuthUsers() {
  console.log('👥 Starting Auth users migration...');

  try {
    // Initialize old project
    const oldApp = admin.initializeApp({
      credential: admin.credential.cert(oldServiceAccount),
      projectId: oldConfig.projectId
    }, 'old-auth');

    const oldAuth = admin.auth(oldApp);

    // Initialize new project
    const newApp = admin.initializeApp({
      credential: admin.credential.cert(newServiceAccount),
      projectId: newConfig.projectId
    }, 'new-auth');

    const newAuth = admin.auth(newApp);

    // Export users from old project
    const usersResult = await oldAuth.listUsers(1000);
    console.log(`📊 Found ${usersResult.users.length} users to migrate`);

    for (const user of usersResult.users) {
      try {
        // Create user in new project
        await newAuth.createUser({
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          photoURL: user.photoURL,
          disabled: user.disabled,
          // Note: Password hashes cannot be migrated directly
          // Users will need to reset passwords or use password reset
        });

        console.log(`   ✅ Migrated user: ${user.email}`);
      } catch (error) {
        console.error(`   ❌ Failed to migrate user ${user.email}:`, error.message);
      }
    }

    console.log('✅ Auth users migration completed!');

    // Cleanup
    await oldApp.delete();
    await newApp.delete();

  } catch (error) {
    console.error('❌ Auth migration failed:', error);
    process.exit(1);
  }
}

// Run migration
async function main() {
  console.log('🔥 Firebase Project Migration Tool');
  console.log('=====================================');
  console.log(`From: ${oldConfig.projectId}`);
  console.log(`To:   ${newConfig.projectId}`);
  console.log('');

  // Check if service account files exist
  const oldKeyPath = path.join(__dirname, 'old-service-account.json');
  const newKeyPath = path.join(__dirname, 'new-service-account.json');

  if (!fs.existsSync(oldKeyPath)) {
    console.error('❌ Old service account key not found!');
    console.log('Please download the service account key for the old project and save as "old-service-account.json"');
    process.exit(1);
  }

  if (!fs.existsSync(newKeyPath)) {
    console.error('❌ New service account key not found!');
    console.log('Please download the service account key for the new project and save as "new-service-account.json"');
    process.exit(1);
  }

  // Load service account keys
  const oldKey = JSON.parse(fs.readFileSync(oldKeyPath, 'utf8'));
  const newKey = JSON.parse(fs.readFileSync(newKeyPath, 'utf8'));

  Object.assign(oldServiceAccount, oldKey);
  Object.assign(newServiceAccount, newKey);

  // Run migrations
  await migrateFirestoreData();
  await migrateAuthUsers();

  console.log('');
  console.log('🎉 Migration completed successfully!');
  console.log('');
  console.log('⚠️  Important Notes:');
  console.log('   - User passwords cannot be migrated. Users will need to reset passwords.');
  console.log('   - Storage files need to be migrated separately if any exist.');
  console.log('   - Test the app thoroughly before going live.');
}

main().catch(console.error);