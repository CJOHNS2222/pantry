#!/usr/bin/env node
/*
  build_recipe_cache.cjs

  Reads all recipe documents from 'recipes' and 'recipe_search_index' collections
  and writes them into chunked cache documents to reduce client read fan-out.

  Usage:
    node scripts/build_recipe_cache.cjs --project <firebase-project-id> [--target caches/recipes] [--max-bytes 800000] [--dry-run]

  Notes:
  - This script uses the Firebase Admin SDK. Set GOOGLE_APPLICATION_CREDENTIALS to a
    service account JSON with Firestore access, or ensure application default credentials.
  - It writes documents with IDs like `recipes_cache_1`, `recipes_cache_2`, ... under the
    target collection path (default `caches/recipes`). Each document will contain a `recipes` array.
*/

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    project: process.env.FIREBASE_PROJECT || null,
    // Default to a clear top-level collection that contains cache documents
    target: 'recipe_caches',
    maxBytes: 800000,
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project' && args[i+1]) { out.project = args[++i]; }
    else if (a === '--target' && args[i+1]) { out.target = args[++i]; }
    else if (a === '--max-bytes' && args[i+1]) { out.maxBytes = parseInt(args[++i], 10); }
    else if (a === '--dry-run') { out.dryRun = true; }
  }
  return out;
}

(async function main(){
  const opts = parseArgs();

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG && !opts.project) {
    console.warn('Warning: No GOOGLE_APPLICATION_CREDENTIALS or project provided. Make sure Admin SDK can authenticate.');
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  } catch (err) {
    console.error('Failed to initialize firebase-admin:', err);
    process.exit(1);
  }

  const db = admin.firestore();

  const collectionsToRead = ['recipes', 'recipe_search_index'];
  console.log('Reading collections:', collectionsToRead.join(', '));

  let allRecipes = [];

  for (const col of collectionsToRead) {
    try {
      const snap = await db.collection(col).get();
      console.log(`  - ${col}: ${snap.size} docs`);
      snap.forEach(doc => {
        const data = doc.data();
        // Keep id to allow de-duplication and easy lookup
        allRecipes.push({ _id: doc.id, ...data });
      });
    } catch (err) {
      console.error(`Failed to read collection ${col}:`, err);
    }
  }

  // De-duplicate by _id (latest wins)
  const map = new Map();
  for (const r of allRecipes) map.set(r._id, r);
  const recipes = Array.from(map.values());
  console.log(`Total unique recipes collected: ${recipes.length}`);

  // Partition into batches respecting maxBytes
  const batches = [];
  let cur = [];
  let curBytes = 0;
  for (const r of recipes) {
    const entryStr = JSON.stringify(r);
    const entryBytes = Buffer.byteLength(entryStr, 'utf8');
    // If single entry exceeds max, we still include it but warn
    if (entryBytes > opts.maxBytes) {
      console.warn(`Warning: recipe ${r._id} exceeds maxBytes (${entryBytes} bytes). It will be written alone in one doc.`);
    }

    if (curBytes + entryBytes > opts.maxBytes && cur.length > 0) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }

    cur.push(r);
    curBytes += entryBytes;
  }
  if (cur.length > 0) batches.push(cur);

  console.log(`Partitioned into ${batches.length} cache document(s) (maxBytes=${opts.maxBytes})`);

  // Write batches to target collection. The script writes documents under a top-level
  // collection with IDs like `recipes_cache_1`, `recipes_cache_2`, ...
  const targetCollection = opts.target.replace(/^\/|\/$/g, ''); // strip leading/trailing slash

  for (let i = 0; i < batches.length; i++) {
    const batchRecipes = batches[i].map(r => ({ id: r._id, ...r }));
    const docId = `recipes_cache_${i+1}`;
    const docPath = `${targetCollection}/${docId}`;

    console.log(`Writing batch ${i+1}/${batches.length} -> ${docPath} (recipes: ${batchRecipes.length})`);

    if (opts.dryRun) continue;

    try {
      const colRef = db.collection(targetCollection);
      await colRef.doc(docId).set({ recipes: batchRecipes, createdAt: admin.firestore.FieldValue.serverTimestamp() });

      // Also write a copy under `system/` so clients (authenticated users)
      // can read the cached recipes when `recipe_caches` is admin-only.
      try {
        const systemPath = `system/${docId}`;
        await db.doc(systemPath).set({ recipes: batchRecipes, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        console.log(`Also wrote system copy: ${systemPath}`);
      } catch (sysErr) {
        console.warn(`Failed to write system copy for ${docId}:`, sysErr);
      }
    } catch (err) {
      console.error(`Failed to write batch ${i+1}:`, err);
    }
  }

  console.log('Done.');
  process.exit(0);
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
