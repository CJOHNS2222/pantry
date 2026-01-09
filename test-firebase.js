import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🔥 Firebase Connection Test');
  console.log('===========================');

  try {
    // Load service account keys
    const oldKeyPath = path.join(__dirname, 'old-service-account.json');
    const newKeyPath = path.join(__dirname, 'new-service-account.json');

    if (!fs.existsSync(oldKeyPath)) {
      console.error('❌ Old service account key not found at:', oldKeyPath);
      process.exit(1);
    }

    if (!fs.existsSync(newKeyPath)) {
      console.error('❌ New service account key not found at:', newKeyPath);
      process.exit(1);
    }

    const oldServiceAccount = JSON.parse(fs.readFileSync(oldKeyPath, 'utf8'));
    const newServiceAccount = JSON.parse(fs.readFileSync(newKeyPath, 'utf8'));

    console.log(`From: ${oldServiceAccount.project_id}`);
    console.log(`To:   ${newServiceAccount.project_id}`);
    console.log('');

    // Test old project
    console.log('🔍 Testing old project connection...');
    const oldApp = admin.initializeApp({
      credential: admin.credential.cert(oldServiceAccount),
      projectId: oldServiceAccount.project_id
    }, 'test-old');

    const oldDb = admin.firestore(oldApp);
    const oldCollections = await oldDb.listCollections();
    console.log(`✅ Old project connected - found ${oldCollections.length} collections`);

    // Show some collection names
    if (oldCollections.length > 0) {
      console.log('   Collections:', oldCollections.slice(0, 5).map(c => c.id).join(', '));
    }

    await oldApp.delete();

    // Test new project
    console.log('🔍 Testing new project connection...');
    const newApp = admin.initializeApp({
      credential: admin.credential.cert(newServiceAccount),
      projectId: newServiceAccount.project_id,
      databaseURL: `https://data.firebaseio.com` // Specify the data database
    }, 'test-new');

    const newDb = admin.firestore(newApp);
    const newCollections = await newDb.listCollections();
    console.log(`✅ New project connected - found ${newCollections.length} collections in 'data' database`);

    await newApp.delete();

    console.log('');
    console.log('🎉 Both projects are accessible!');
    console.log('You can now proceed with data migration.');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Verify service account keys are valid JSON');
    console.log('2. Check that Firestore is enabled in both projects');
    console.log('3. Ensure service accounts have Firestore Admin permissions');
    console.log('4. Try regenerating the service account keys');
  }
}

main().catch(console.error);