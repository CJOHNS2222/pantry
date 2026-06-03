#!/usr/bin/env node
'use strict';

/**
 * seed-ingredient-images-fallback.cjs
 *
 * Second-pass image seeder for items that Spoonacular CDN doesn't have.
 * Tries sources in order:
 *   1. Wikimedia Commons / Wikipedia page image  (free, no key, great for produce)
 *   2. Open Food Facts                            (free, no key, good for packaged goods)
 *   3. Unsplash                                   (requires VITE_UNSPLASH_ACCESS_KEY)
 *
 * Usage:
 *   node scripts/seed-ingredient-images-fallback.cjs
 *   node scripts/seed-ingredient-images-fallback.cjs --limit 30
 *   node scripts/seed-ingredient-images-fallback.cjs --source wikipedia   # only try Wikipedia
 *   node scripts/seed-ingredient-images-fallback.cjs --source openfoodfacts
 *   node scripts/seed-ingredient-images-fallback.cjs --source unsplash
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'items');
const TS_OUTPUT = path.join(ROOT, 'data', 'item-images.ts');
const PROGRESS_FILE = path.join(__dirname, '.image-seed-progress.json');
const MISSING_FILE = path.join(__dirname, '.missing-items.json');
const ENV_PATH = path.join(ROOT, '.env.local');
const FALLBACK_PROGRESS = path.join(__dirname, '.fallback-progress.json');
const CDN_SIZE = '500x500';

// ─── Known-bad hashes (Spoonacular placeholder, etc.) ────────────────────────
const BAD_HASHES = new Set([
  'e5e28152a2797ed1c3ffb6e2db37423c', // Spoonacular food-cloche placeholder
]);

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const sourceIdx = args.indexOf('--source');
const SOURCE_FILTER = sourceIdx !== -1 ? args[sourceIdx + 1] : null;
const RESUME = args.includes('--resume');

// ─── Load env ─────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (m) vars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return vars;
  } catch { return {}; }
}
const env = loadEnv();
const UNSPLASH_KEY = env.VITE_UNSPLASH_ACCESS_KEY || '';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(rawUrl, opts = {}, redirectCount = 0) {
  return new Promise(resolve => {
    if (redirectCount > 5) return resolve(null);
    try {
      const parsed = new URL(rawUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const headers = { 'User-Agent': 'StockAndSpoon/2.0 (food pantry app)', ...opts.headers };
      lib.get(rawUrl, { headers }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
          return resolve(httpGet(loc, opts, redirectCount + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    } catch { resolve(null); }
  });
}

async function fetchJson(url, headers = {}) {
  const buf = await httpGet(url, { headers });
  if (!buf) return null;
  try { return JSON.parse(buf.toString()); } catch { return null; }
}

function isPlaceholder(buf) {
  if (!buf || buf.length < 500) return true;
  return BAD_HASHES.has(crypto.createHash('md5').update(buf).digest('hex'));
}

async function downloadImage(url) {
  const buf = await httpGet(url);
  return (!buf || isPlaceholder(buf)) ? null : buf;
}

// ─── Source 1: Wikipedia / Wikimedia Commons ─────────────────────────────────
async function tryWikipedia(itemName) {
  // Get Wikipedia page image for the item
  const query = encodeURIComponent(itemName);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${query}&prop=pageimages&format=json&pithumbsize=600&redirects=1`;
  const data = await fetchJson(apiUrl);
  if (!data) return null;

  const pages = data.query && data.query.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  const imgUrl = page.thumbnail && page.thumbnail.source;
  if (!imgUrl) return null;

  // Reject SVG (usually icons/logos) and very small thumbnails
  if (imgUrl.endsWith('.svg') || imgUrl.includes('/svg/')) return null;

  const buf = await downloadImage(imgUrl);
  return buf;
}

// ─── Source 2: Open Food Facts ────────────────────────────────────────────────
async function tryOpenFoodFacts(itemName) {
  const clean = itemName.replace(/[^a-z0-9 ]/gi, '').trim();
  const apiUrl = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(clean)}&fields=product_name,image_front_url&page_size=8&sort_by=popularity_key`;
  const data = await fetchJson(apiUrl);
  if (!data || !data.products) return null;

  for (const product of data.products) {
    const imgUrl = product.image_front_url;
    if (!imgUrl) continue;

    // Rough relevance check: at least one search word in product name
    const productName = (product.product_name || '').toLowerCase();
    const searchWords = clean.toLowerCase().split(' ').filter(w => w.length > 2);
    const relevant = searchWords.some(w => productName.includes(w)) || productName.includes(clean.toLowerCase());
    if (!relevant) continue;

    const buf = await downloadImage(imgUrl);
    if (buf) return buf;
  }
  return null;
}

// ─── Source 3: Unsplash ───────────────────────────────────────────────────────
async function tryUnsplash(itemName) {
  if (!UNSPLASH_KEY) return null;
  const query = encodeURIComponent(itemName + ' food ingredient');
  const apiUrl = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=squarish`;
  const data = await fetchJson(apiUrl, { Authorization: `Client-ID ${UNSPLASH_KEY}` });
  if (!data || !data.results || data.results.length === 0) return null;

  const imgUrl = data.results[0].urls && data.results[0].urls.regular;
  if (!imgUrl) return null;

  const buf = await downloadImage(imgUrl);
  return buf;
}

// ─── Progress tracking ────────────────────────────────────────────────────────
function loadFallbackProgress() {
  try {
    if (fs.existsSync(FALLBACK_PROGRESS))
      return JSON.parse(fs.readFileSync(FALLBACK_PROGRESS, 'utf8'));
  } catch {}
  return { done: [] };
}

// ─── Regenerate data/item-images.ts ──────────────────────────────────────────
function writeOutputTs(mapping) {
  const entries = Object.entries(mapping)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',')
    .join('\n');

  const lines = [
    '/**',
    ' * AUTO-GENERATED by scripts/seed-ingredient-images.cjs',
    ' * DO NOT EDIT MANUALLY -- run `npm run seed:images` to regenerate.',
    ' *',
    ' * Maps normalized item names => ingredient image filenames.',
    ' *',
    ' * Sources: Spoonacular CDN, Wikipedia, Open Food Facts, Unsplash',
    ' *',
    ' * To rebuild: npm run seed:images && npm run seed:images:fallback',
    ' * Generated: ' + new Date().toISOString(),
    ' * Items: ' + Object.keys(mapping).length,
    ' */',
    'export const itemImages: Record<string, string> = {',
    entries,
    '};',
    '',
    '/** CDN base URL for fallback when local image is unavailable (fresh clone etc.) */',
    "export const ITEM_IMAGE_CDN_BASE = 'https://spoonacular.com/cdn/ingredients_" + CDN_SIZE + "/';",
    '',
  ];
  fs.writeFileSync(TS_OUTPUT, lines.join('\n'));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  // Load missing items
  let missing;
  if (fs.existsSync(MISSING_FILE)) {
    missing = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));
  } else {
    // Derive from progress file
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    const mapped = new Set(Object.keys(progress.mapping));
    missing = progress.completed.filter(k => !mapped.has(k));
  }

  const fallbackProgress = RESUME ? loadFallbackProgress() : { done: [] };
  const doneSet = new Set(fallbackProgress.done);
  const toProcess = missing.filter(k => !doneSet.has(k)).slice(0, LIMIT);

  // Load main progress mapping to append to
  const mainProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));

  const allSources = {
    wikipedia:     { name: 'Wikipedia',     fn: tryWikipedia,     delay: 250 },
    openfoodfacts: { name: 'OpenFoodFacts', fn: tryOpenFoodFacts, delay: 500 },
    unsplash:      UNSPLASH_KEY ? { name: 'Unsplash', fn: tryUnsplash, delay: 1500 } : null,
  };

  const sources = SOURCE_FILTER
    ? [allSources[SOURCE_FILTER]].filter(Boolean)
    : [allSources.wikipedia, allSources.openfoodfacts, allSources.unsplash].filter(Boolean);

  console.log('\n  Ingredient Image Fallback Seeder');
  console.log('   Missing items:  ', missing.length);
  console.log('   Already done:   ', doneSet.size);
  console.log('   To process:     ', toProcess.length);
  console.log('   Sources:        ', sources.map(s => s.name).join(' → '));
  console.log('   Unsplash key:   ', UNSPLASH_KEY ? 'found' : 'not set (will skip)');
  console.log();

  let found = 0, failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const pct = Math.round(((doneSet.size + i + 1) / missing.length) * 100);
    process.stdout.write(`[${String(pct).padStart(3)}%] ${item.padEnd(30)}`);

    let imageBuf = null;
    let usedSource = null;
    let currentDelay = 300;

    for (const source of sources) {
      try {
        imageBuf = await source.fn(item);
      } catch { imageBuf = null; }
      currentDelay = source.delay;
      if (imageBuf) { usedSource = source.name; break; }
      await sleep(200);
    }

    if (imageBuf) {
      const ext = '.jpg';
      const safeName = item.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const localFilename = `${safeName}_fb${ext}`; // _fb suffix = fallback source
      const destPath = path.join(IMAGES_DIR, localFilename);
      fs.writeFileSync(destPath, imageBuf);
      mainProgress.mapping[item] = localFilename;
      found++;
      process.stdout.write(`ok  ${localFilename}  [${usedSource}]\n`);
    } else {
      failed++;
      process.stdout.write(`--  (no image found)\n`);
    }

    fallbackProgress.done.push(item);
    fs.writeFileSync(FALLBACK_PROGRESS, JSON.stringify(fallbackProgress, null, 2));
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(mainProgress, null, 2));

    if ((i + 1) % 20 === 0) writeOutputTs(mainProgress.mapping);

    await sleep(currentDelay);
  }

  writeOutputTs(mainProgress.mapping);

  console.log('\nDone!');
  console.log('   Found:        ', found, 'new images');
  console.log('   Not found:    ', failed, 'items still without images');
  console.log('   Total mapped: ', Object.keys(mainProgress.mapping).length);
  console.log();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
