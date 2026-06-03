#!/usr/bin/env node

/**
 * Label every recipe in recipe_caches/* with:
 *   mealType : 'breakfast' | 'lunch' | 'dinner'
 *   cuisine  : e.g. 'italian' | 'mexican' | 'greek' | 'american' | ...
 *
 * Uses a local Ollama model -- completely free, no API key needed.
 * Make sure Ollama is running: ollama serve
 *
 * Usage:
 *   node scripts/label-recipe-cache.js            # label all unlabelled
 *   node scripts/label-recipe-cache.js --force    # re-label everything
 *   node scripts/label-recipe-cache.js --dry-run  # preview only, no writes
 *   node scripts/label-recipe-cache.js --model mistral   # pick a different model
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const projectRoot = join(__dirname, '..');

// -- CLI flags
const args    = process.argv.slice(2);
const FORCE   = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const BATCH   = 10;

const modelFlagIdx = args.indexOf('--model');
const MODEL = modelFlagIdx !== -1 && args[modelFlagIdx + 1]
  ? args[modelFlagIdx + 1]
  : 'gemma3:1b'; // fast 1B model — plenty for classification

// Disable chain-of-thought for qwen3/deepseek-r1 style models (massive speedup)
const THINK_DISABLED = /qwen3|deepseek-r1/i.test(MODEL);

const OLLAMA_URL = 'http://localhost:11434/api/chat';

// -- Load .env.local
const envVars = {};
try {
  readFileSync(join(projectRoot, '.env.local'), 'utf8')
    .split('\n')
    .forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const key = line.slice(0, eq).trim();
      let val   = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    });
} catch {
  console.error('Could not read .env.local');
  process.exit(1);
}

// -- Firebase Admin
let app;
try {
  const saPath = join(projectRoot, 'firebase-service-account.json');
  const sa     = JSON.parse(readFileSync(saPath, 'utf8'));
  app          = initializeApp({ credential: cert(sa), projectId: envVars.VITE_PROJECT_ID });
} catch (e) {
  console.error('Firebase init failed:', e.message);
  process.exit(1);
}
const db = getFirestore(app);

// -- Ollama helpers

async function checkOllama() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const available = (data.models || []).map(m => m.name);
    const modelBase = MODEL.replace(':latest', '');
    if (!available.some(n => n.startsWith(modelBase))) {
      console.error(`Model "${MODEL}" not found. Available: ${available.join(', ')}`);
      console.error(`Run: ollama pull ${MODEL}`);
      process.exit(1);
    }
    console.log(`Ollama running -- model: ${MODEL}\n`);
  } catch (e) {
    if (e.name === 'TimeoutError' || e.cause?.code === 'ECONNREFUSED') {
      console.error('Ollama is not running. Start it with: ollama serve');
    } else {
      console.error('Could not reach Ollama:', e.message);
    }
    process.exit(1);
  }
}

async function ollamaChat(userMessage) {
  const body = {
    model: MODEL,
    stream: false,
    options: { temperature: 0.1 },
    messages: [{ role: 'user', content: userMessage }]
  };
  // think:false skips qwen3's chain-of-thought — cuts response time by ~80%
  if (THINK_DISABLED) body.think = false;

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  let text = data.message?.content ?? '';
  // Strip <think>...</think> blocks (qwen3, deepseek-r1, etc.)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return text;
}

async function classifyBatch(recipes) {
  const recipeList = recipes.map((r, i) => {
    const ingredients = Array.isArray(r.ingredients)
      ? r.ingredients.slice(0, 8).join(', ')
      : '';
    return `${i + 1}. Title: "${r.title}"${ingredients ? `\n   Ingredients: ${ingredients}` : ''}`;
  }).join('\n\n');

  const prompt = `You are a culinary expert. Classify each recipe below.

For each recipe assign:
- mealType: one of "breakfast", "lunch", or "dinner"
- cuisine: primary cuisine in lowercase from: italian, mexican, greek, american, chinese, japanese, indian, french, thai, mediterranean, spanish, middle eastern, korean, other

Rules:
- breakfast = morning foods (eggs, pancakes, oatmeal, waffles, French toast, bacon, muffins, granola, smoothies)
- lunch = lighter daytime meals (sandwiches, salads, soups, wraps, grain bowls)
- dinner = main evening meals (roasts, pasta mains, curries, steak, casseroles, stews)
- When ambiguous, prefer "dinner"

Respond ONLY with a JSON array of exactly ${recipes.length} objects in the same order:
[{"mealType":"...","cuisine":"..."},...]

No explanation. No markdown fences. Just the raw JSON array.

Recipes:
${recipeList}`;

  const raw = await ollamaChat(prompt);

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('\n  JSON array not found, using fallback. Raw:', raw.slice(0, 200));
    return recipes.map(() => ({ mealType: 'dinner', cuisine: 'other' }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    while (parsed.length < recipes.length) parsed.push({ mealType: 'dinner', cuisine: 'other' });
    return parsed.slice(0, recipes.length).map(item => ({
      mealType: ['breakfast', 'lunch', 'dinner'].includes(item.mealType) ? item.mealType : 'dinner',
      cuisine:  typeof item.cuisine === 'string' ? item.cuisine.toLowerCase() : 'other'
    }));
  } catch {
    console.warn('\n  JSON parse failed, using fallback. Raw:', raw.slice(0, 200));
    return recipes.map(() => ({ mealType: 'dinner', cuisine: 'other' }));
  }
}

// -- Main

async function main() {
  console.log(`Recipe cache labeller (Ollama / local / free)${DRY_RUN ? ' [DRY RUN]' : ''}${FORCE ? ' [FORCE]' : ''}\n`);

  await checkOllama();

  const colSnap = await db.collection('recipe_caches').get();

  if (colSnap.empty) {
    console.log('No documents found in recipe_caches/');
    return;
  }

  console.log(`Found ${colSnap.size} cache chunk(s)\n`);

  let totalRecipes  = 0;
  let totalLabelled = 0;

  for (const chunkDoc of colSnap.docs) {
    const data    = chunkDoc.data();
    const recipes = data.recipes;

    if (!Array.isArray(recipes)) {
      console.log(`${chunkDoc.id}: no "recipes" array, skipping`);
      continue;
    }

    console.log(`${chunkDoc.id}: ${recipes.length} recipes`);

    const toLabel = FORCE
      ? recipes.map((r, i) => ({ r, i }))
      : recipes.map((r, i) => ({ r, i })).filter(({ r }) => !r.mealType || !r.cuisine);

    if (toLabel.length === 0) {
      console.log('  All already labelled, skipping\n');
      totalRecipes += recipes.length;
      continue;
    }

    const alreadyDone = recipes.length - toLabel.length;
    console.log(`  Labelling ${toLabel.length}${alreadyDone > 0 ? `, ${alreadyDone} already done` : ''}`);

    const updated = recipes.map(r => ({ ...r }));

    for (let start = 0; start < toLabel.length; start += BATCH) {
      const batchItems   = toLabel.slice(start, start + BATCH);
      const batchRecipes = batchItems.map(({ r }) => r);
      const batchNum     = Math.floor(start / BATCH) + 1;
      const totalBatches = Math.ceil(toLabel.length / BATCH);
      const preview      = batchRecipes.slice(0, 3).map(r => `"${r.title}"`).join(', ');

      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${preview}${batchRecipes.length > 3 ? '...' : ''})... `);

      let labels;
      try {
        labels = await classifyBatch(batchRecipes);
        console.log('done');
      } catch (err) {
        console.log('FAILED:', err.message);
        labels = batchRecipes.map(() => ({ mealType: 'dinner', cuisine: 'other' }));
      }

      batchItems.forEach(({ i }, j) => {
        updated[i] = { ...updated[i], mealType: labels[j].mealType, cuisine: labels[j].cuisine };
      });
    }

    totalRecipes  += recipes.length;
    totalLabelled += toLabel.length;

    if (!DRY_RUN) {
      await chunkDoc.ref.update({ recipes: updated, lastUpdated: new Date() });
      console.log(`  Saved ${chunkDoc.id}\n`);
    } else {
      const sample = toLabel.slice(0, 6).map(({ i }) => updated[i]);
      sample.forEach(r => console.log(`    "${r.title}" -> ${r.mealType} / ${r.cuisine}`));
      console.log(`  (dry-run - not saved)\n`);
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Done. ${totalLabelled} labelled, ${totalRecipes - totalLabelled} already had labels.`);
  if (DRY_RUN) console.log('Dry-run -- no changes written to Firestore.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
