/**
 * publish-version.cjs
 *
 * Publishes the current version from package.json to Firestore app_versions/{platform}
 * for all platforms. All connected clients will see the new version on their next
 * "Check for Updates" — no app store update required for the notification to appear.
 *
 * Usage:
 *   node scripts/publish-version.cjs
 *   node scripts/publish-version.cjs --version 1.6.0 --notes "Major UI refresh"
 *
 * Run this after every release build to keep the remote version in sync.
 * Requires Application Default Credentials:
 *   gcloud auth application-default login
 */

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// --- Parse CLI args ---
const args = process.argv.slice(2);
const argVersion = args.find((_, i) => args[i - 1] === '--version');
const argNotes = args.find((_, i) => args[i - 1] === '--notes');
const forceUpdate = args.includes('--force');

// --- Read version from package.json if not provided ---
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = argVersion || pkg.version;
const releaseNotes = argNotes || `Version ${version} — see CHANGELOG.md for details.`;

const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
if (!apps.length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || require('path').join(__dirname, 'ornate-compass-478504-e1-firebase-adminsdk-fbsvc-b421e3c5e1.json');
  const fs = require('fs');
  if (fs.existsSync(credPath)) {
    const credential = admin.credential ? admin.credential.cert(credPath) : admin.cert(credPath);
    admin.initializeApp({
      credential,
      projectId: 'ornate-compass-478504-e1',
    });
  } else {
    admin.initializeApp({ projectId: 'ornate-compass-478504-e1' });
  }
}
const db = admin.firestore ? admin.firestore() : getFirestore();

const PLATFORM_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.smart.pantry',
  ios: 'https://apps.apple.com/app/smart-pantry/id1234567890',
  web: null,
};

async function publishVersion() {
  console.log(`\n📦 Publishing version ${version} to Firestore...\n`);

  for (const [platform, downloadUrl] of Object.entries(PLATFORM_URLS)) {
    const data = {
      version,
      platform,
      releaseNotes,
      forceUpdate,
      downloadUrl: downloadUrl ?? null,
      publishedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('app_versions').doc(platform).set(data, { merge: true });
    console.log(`  ✅ ${platform}: ${version}`);
  }

  console.log('\n🎉 Done — all clients will see the update on next check.\n');
}

publishVersion()
  .catch((err) => {
    console.error('❌ Failed to publish version:', err.message);
    process.exit(1);
  })
  .finally(() => {
    const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
    if (apps.length > 0) {
      if (admin.deleteApp) {
        admin.deleteApp(apps[0]);
      } else if (apps[0].delete) {
        apps[0].delete();
      }
    }
  });
