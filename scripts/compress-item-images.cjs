/**
 * One-time script to compress /public/images/items/*.png
 *
 * What it does:
 *   - Resizes each image to fit within 400×400 (preserving aspect ratio)
 *   - Re-encodes as PNG with compressionLevel 9 + palette quantization
 *   - Overwrites in-place (no filename/reference changes needed)
 *
 * Run with:  node scripts/compress-item-images.cjs
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const MAX_DIMENSION = 400;

async function compress() {
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith('.png'));

  console.log(`Found ${files.length} PNG files in ${INPUT_DIR}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const errors = [];

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    const sizeBefore = fs.statSync(filePath).size;
    totalBefore += sizeBefore;

    try {
      const compressed = await sharp(filePath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',          // never upscale, maintain aspect ratio
          withoutEnlargement: true,
        })
        .png({
          compressionLevel: 9,   // max zlib compression (lossless)
          adaptiveFiltering: true,
          palette: true,          // quantize to 256-colour palette (lossy but visually good)
          quality: 80,            // palette quality (0–100)
          effort: 10,             // max encoding effort
        })
        .toBuffer();

      fs.writeFileSync(filePath, compressed);

      const sizeAfter = compressed.length;
      totalAfter += sizeAfter;

      const saved = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);
      console.log(`  ✓ ${file.padEnd(40)} ${(sizeBefore/1024).toFixed(0).padStart(5)} KB → ${(sizeAfter/1024).toFixed(0).padStart(4)} KB  (−${saved}%)`);
    } catch (err) {
      errors.push({ file, err: err.message });
      totalAfter += sizeBefore; // count unchanged
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(1);
  const savedPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);

  console.log('\n─────────────────────────────────────────────────');
  console.log(`Before : ${(totalBefore / 1024 / 1024).toFixed(1)} MB`);
  console.log(`After  : ${(totalAfter  / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Saved  : ${savedMB} MB  (${savedPct}%)`);

  if (errors.length) {
    console.log(`\n${errors.length} file(s) failed — left unchanged.`);
  }
}

compress().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
