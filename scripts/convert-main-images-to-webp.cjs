#!/usr/bin/env node
'use strict';

/**
 * Converts public/images/*.png → *.webp
 * and updates the hardcoded references in utils/appUtils.ts.
 *
 * Run with: node scripts/convert-main-images-to-webp.cjs
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const APP_UTILS = path.join(__dirname, '..', 'utils', 'appUtils.ts');
const WEBP_QUALITY = 82;

async function run() {
  const pngs = fs.readdirSync(IMAGES_DIR).filter(f => f.toLowerCase().endsWith('.png'));
  console.log(`Found ${pngs.length} PNG files in public/images/\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const failed = [];

  for (const file of pngs) {
    const src = path.join(IMAGES_DIR, file);
    const dest = path.join(IMAGES_DIR, file.replace(/\.png$/i, '.webp'));
    const sizeBefore = fs.statSync(src).size;
    totalBefore += sizeBefore;

    try {
      await sharp(src)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(dest);

      const sizeAfter = fs.statSync(dest).size;
      totalAfter += sizeAfter;

      const savedPct = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);
      console.log(`  ✓ ${file.padEnd(45)} ${(sizeBefore/1024).toFixed(0).padStart(4)} KB → ${(sizeAfter/1024).toFixed(0).padStart(3)} KB  (−${savedPct}%)`);

      fs.unlinkSync(src);
    } catch (err) {
      failed.push({ file, err: err.message });
      totalAfter += sizeBefore;
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  // Update hardcoded .png references in appUtils.ts
  let ts = fs.readFileSync(APP_UTILS, 'utf8');
  const before = ts;
  // Replace .png filenames that we successfully converted (have a .webp on disk now)
  ts = ts.replace(/'([^']+\.png)'/g, (match, name) => {
    const webpName = name.replace(/\.png$/i, '.webp');
    const webpPath = path.join(IMAGES_DIR, webpName);
    return fs.existsSync(webpPath) ? `'${webpName}'` : match;
  });
  if (ts !== before) {
    fs.writeFileSync(APP_UTILS, ts, 'utf8');
    console.log('\n  ✓ Updated utils/appUtils.ts');
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
