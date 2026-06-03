#!/usr/bin/env node
/**
 * One-time migration: reformat "step 1 ... step 2 ..." instructions
 * into a proper numbered array ["Do this.", "Do that.", ...].
 *
 * Usage: node scripts/fix-recipe-instructions.js
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env.local
let envVars = {};
try {
  const envContent = readFileSync(join(projectRoot, '.env.local'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      const val = rest.join('=').trim().replace(/^"|"$/g, '');
      envVars[key.trim()] = val;
    }
  });
} catch { /* ignore */ }

// Load service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(projectRoot, 'firebase-service-account.json'), 'utf8'));
} catch {
  console.error('❌ firebase-service-account.json not found');
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount), projectId: envVars.VITE_PROJECT_ID });
const db = getFirestore(app);

/**
 * Parse "step 1 ... step 2 ..." text into a clean array of step strings.
 */
function parseStepInstructions(raw) {
  if (!raw || typeof raw !== 'string') return [];
  if (!/step\s+\d+/i.test(raw)) return [raw.trim()].filter(Boolean);
  return raw
    .split(/step\s+\d+\s*/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function main() {
  console.log('🔍 Loading all recipes from Firestore...');
  const snapshot = await db.collection('recipes').get();
  console.log(`📦 Found ${snapshot.size} recipes`);

  const toFix = [];
  for (const doc of snapshot.docs) {
    const { instructions } = doc.data();
    if (!Array.isArray(instructions)) continue;
    const needsFix = instructions.some(
      instr => typeof instr === 'string' && /step\s+\d+/i.test(instr)
    );
    if (needsFix) toFix.push(doc);
  }

  console.log(`🔧 ${toFix.length} recipes need instruction reformatting`);
  if (toFix.length === 0) {
    console.log('✅ Nothing to fix!');
    process.exit(0);
  }

  // Batch update in groups of 499 (Firestore limit is 500)
  let fixed = 0;
  for (let i = 0; i < toFix.length; i += 499) {
    const batchDocs = toFix.slice(i, i + 499);
    const batch = db.batch();
    for (const doc of batchDocs) {
      const { instructions } = doc.data();
      const fixedInstructions = instructions.flatMap(instr =>
        typeof instr === 'string' && /step\s+\d+/i.test(instr)
          ? parseStepInstructions(instr)
          : [instr]
      );
      batch.update(doc.ref, { instructions: fixedInstructions });
      fixed++;
    }
    await batch.commit();
    console.log(`✅ Batch committed (${batchDocs.length} recipes, ${fixed}/${toFix.length} total)`);
  }

  console.log(`\n🎉 Done! Fixed ${fixed} recipes.`);
  console.log('📋 Now run: node scripts/rebuild-recipes-cache.js');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
