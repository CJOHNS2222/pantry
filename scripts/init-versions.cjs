const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase config - using actual values from .env.local
const firebaseConfig = {
  apiKey: "AIzaSyBqJB2SjnyoKvNPx5jZbGD96DnqMLrVsOc",
  authDomain: "gen-lang-client-0893655267.firebaseapp.com",
  projectId: "gen-lang-client-0893655267",
  storageBucket: "gen-lang-client-0893655267.appspot.com",
  messagingSenderId: "651327126572",
  appId: "1:651327126572:web:2ab6f25e9b9bd0caff6589",
  measurementId: "G-EX7Q4N2Z81"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeAppVersions() {
  try {
    console.log('Initializing app version data...');

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
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'app_versions', platform), versionData);
      console.log(`✅ Initialized version data for ${platform}`);
    }

    console.log('🎉 All app versions initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize app versions:', error);
    throw error;
  }
}

initializeAppVersions().catch(console.error);