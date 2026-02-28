/* Minimal seed script for product_master entries.

Run with:
  node scripts/seedProductMaster.cjs

Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON with Firestore write access.
*/

// Fail fast if credentials not provided to avoid loading heavy deps.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path before running.\nExample: set the env var or run `set GOOGLE_APPLICATION_CREDENTIALS=path\\to\\sa.json`');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch (err) {
  console.error('Missing dependency: could not require "firebase-admin" or one of its sub-dependencies.');
  console.error('Install dependencies with: npm install firebase-admin @google-cloud/firestore @opentelemetry/api');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function seed() {
  const items = [
    {
      id: 'salt',
      name: 'Salt',
      is_immortal: true,
      risk_level: 1,
      tags: ['staple','spice']
    },
    {
      id: 'honey',
      name: 'Honey',
      is_immortal: true,
      risk_level: 1,
      tags: ['staple','sweetener']
    },
    {
      id: 'cooked-rice',
      name: 'Cooked Rice',
      is_immortal: false,
      risk_level: 4,
      tags: ['leftover','cooked-rice']
    }
  ];

  for (const it of items) {
    const ref = db.collection('product_master').doc(it.id);
    console.log('Writing', it.id);
    await ref.set({
      name: it.name,
      is_immortal: it.is_immortal,
      risk_level: it.risk_level,
      tags: it.tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed', err); process.exit(1); });
