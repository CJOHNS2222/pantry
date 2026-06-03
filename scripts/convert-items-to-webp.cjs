#!/usr/bin/env node
'use strict';

/**
 * One-time script: converts public/images/items/*.png → *.webp
 * then updates data/item-images.ts references.
 *
 * Run with: node scripts/convert-items-to-webp.cjs
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ITEMS_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const TS_FILE = path.join(__dirname, '..', 'data', 'item-images.ts');
const WEBP_QUALITY = 82; // visually lossless for food photos, good savings

async function run() {
  const pngs = fs.readdirSync(ITEMS_DIR).filter(f => f.toLowerCase().endsWith('.png'));
  console.log(`Found ${pngs.length} PNG files\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const failed = [];

  for (const file of pngs) {
    const src = path.join(ITEMS_DIR, file);
    const dest = path.join(ITEMS_DIR, file.replace(/\.png$/i, '.webp'));
    const sizeBefore = fs.statSync(src).size;
    totalBefore += sizeBefore;

    try {
      await sharp(src)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(dest);

      const sizeAfter = fs.statSync(dest).size;
      totalAfter += sizeAfter;

      const savedPct = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);
      console.log(`  ✓ ${file.padEnd(45)} ${(sizeBefore/1024).toFixed(0).padStart(5)} KB → ${(sizeAfter/1024).toFixed(0).padStart(4)} KB  (−${savedPct}%)`);

      fs.unlinkSync(src); // remove original PNG
    } catch (err) {
      failed.push({ file, err: err.message });
      totalAfter += sizeBefore;
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  // Update data/item-images.ts
  let ts = fs.readFileSync(TS_FILE, 'utf8');
  const before = ts;
  ts = ts.replace(/"([^"]+)\.png"/g, (match, name) => {
    // Only rewrite if a .webp version now exists on disk
    const webpPath = path.join(ITEMS_DIR, `${name}.webp`);
    return fs.existsSync(webpPath) ? `"${name}.webp"` : match;
  });
  if (ts !== before) {
    fs.writeFileSync(TS_FILE, ts, 'utf8');
    console.log('\n  ✓ Updated data/item-images.ts');
  }

  const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(2);
  const savedPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log('\n─────────────────────────────────────────────────');
  console.log(`Before : ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`After  : ${(totalAfter  / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved  : ${savedMB} MB  (${savedPct}%)`);
  if (failed.length) console.log(`\n${failed.length} file(s) failed — left as PNG.`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
