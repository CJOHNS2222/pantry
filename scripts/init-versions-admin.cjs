const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'gen-lang-client-0893655267'
  });
}

const db = admin.firestore();

async function initializeAppVersions() {
  try {
    console.log('Initializing app version data with Admin SDK...');

    // Initialize version data for different platforms
    const platforms = ['android', 'ios', 'web'];

    for (const platform of platforms) {
      const versionData = {
        version: '1.0.0',
        buildNumber: '1',
        platform,
        releaseNotes: 'Initial release with pantry management features',
        forceUpdate: false,
        downloadUrl: platform === 'android'
          ? 'https://play.google.com/store/apps/details?id=com.smart.pantry'
          : platform === 'ios'
          ? 'https://apps.apple.com/app/smart-pantry/id1234567890'
          : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('app_versions').doc(platform).set(versionData);
      console.log(`✅ Initialized version data for ${platform}`);
    }

    console.log('🎉 All app versions initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize app versions:', error);
    throw error;
  } finally {
    // Clean up
    admin.app().delete();
  }
}

initializeAppVersions().catch(console.error);