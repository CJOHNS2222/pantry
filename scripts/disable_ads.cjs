const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountPath = '../firebase-service-account.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function disableAds() {
  try {
    const config = admin.remoteConfig();
    console.log('Fetching Remote Config template...');
    const template = await config.getTemplate();
    
    // 1. Check top-level parameters
    if (template.parameters && template.parameters.ads_enabled) {
      console.log('Current ads_enabled top-level defaultValue:', template.parameters.ads_enabled.defaultValue);
      template.parameters.ads_enabled.defaultValue = { value: 'false' };
    }
    
    // 2. Check parameter groups
    let foundInGroup = false;
    if (template.parameterGroups) {
      for (const groupName in template.parameterGroups) {
        const group = template.parameterGroups[groupName];
        if (group.parameters && group.parameters.ads_enabled) {
          console.log(`Current ads_enabled in group "${groupName}" defaultValue:`, group.parameters.ads_enabled.defaultValue);
          group.parameters.ads_enabled.defaultValue = { value: 'false' };
          foundInGroup = true;
        }
      }
    }

    if (!foundInGroup) {
      console.log('ads_enabled was not found in any parameter groups.');
    }
    
    console.log('Validating template...');
    await config.validateTemplate(template);
    
    console.log('Publishing updated template...');
    const updatedTemplate = await config.publishTemplate(template);
    console.log('Published template successfully! New version:', updatedTemplate.version.versionNumber);
  } catch (error) {
    console.error('Error disabling ads in Remote Config:', error);
    process.exit(1);
  }
}

disableAds();
