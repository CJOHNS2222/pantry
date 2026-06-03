#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, '..', 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (err) {
  console.error('Failed to load service account from', serviceAccountPath, err.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/checkUsageLimits.js <userId>');
  process.exit(1);
}

(async () => {
  try {
    const docRef = db.doc(`users/${userId}/usage/limits`);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.log(`No usage limits document found for user: ${userId}`);
      process.exit(0);
    }
    console.log(`Usage limits for user ${userId}:`);
    console.log(JSON.stringify(snap.data(), null, 2));
  } catch (err) {
    console.error('Error fetching usage limits:', err);
    process.exit(1);
  }
})();
