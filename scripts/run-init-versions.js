import { initializeAppVersions } from './initializeVersions.js';

async function main() {
  try {
    console.log('Initializing app version data...');
    await initializeAppVersions();
    console.log('✅ App version data initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize app version data:', error);
    process.exit(1);
  }
}

main();