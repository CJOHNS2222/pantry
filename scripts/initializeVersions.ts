import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const initializeAppVersions = async () => {
  try {
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
      console.log(`Initialized version data for ${platform}`);
    }

    console.log('All app versions initialized successfully');
  } catch (err: any) {
    console.error('Failed to initialize app versions:', error);
    throw error;
  }
};

// Example of how to update version info when releasing a new version
export const updateAppVersion = async (
  platform: 'android' | 'ios' | 'web',
  version: string,
  options: {
    buildNumber?: string;
    releaseNotes?: string;
    forceUpdate?: boolean;
    downloadUrl?: string;
  }
) => {
  try {
    const versionData = {
      version,
      platform,
      ...options,
      updatedAt: new Date()
    };

    await setDoc(doc(db, 'app_versions', platform), versionData, { merge: true });
    console.log(`Updated version data for ${platform} to ${version}`);
  } catch (err: any) {
    console.error('Failed to update app version:', error);
    throw error;
  }
};
