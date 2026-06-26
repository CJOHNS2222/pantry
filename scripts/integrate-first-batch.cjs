const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const SOURCE_DIR = 'C:\\Users\\cjohn\\My Online Documents\\extracted_icons\\completed';
const DEST_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const TS_FILE = path.join(__dirname, '..', 'data', 'item-images.ts');
const WEBP_QUALITY = 82; // Standard quality

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory does not exist: ${SOURCE_DIR}`);
    return;
  }

  // Ensure destination directory exists
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  // Read all PNG files
  const pngFiles = fs.readdirSync(SOURCE_DIR)
    .filter(file => file.toLowerCase().endsWith('.png'));

  console.log(`Found ${pngFiles.length} PNG icons in extracted_icons/completed.`);
  if (pngFiles.length === 0) {
    console.log('No PNG icons found to integrate.');
    return;
  }

  // Read the existing item-images.ts file
  let tsContent = fs.readFileSync(TS_FILE, 'utf8');
  const mapRegex = /export\s+const\s+itemImages:\s+Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/;
  const match = tsContent.match(mapRegex);
  if (!match) {
    console.error('Could not parse itemImages map in data/item-images.ts');
    return;
  }

  const existingMapBody = match[1];
  const map = {};
  const lines = existingMapBody.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    
    const kvMatch = trimmed.match(/^["']([^"']+)["']\s*:\s*["']([^"']+)["']\s*,?$/);
    if (kvMatch) {
      map[kvMatch[1]] = kvMatch[2];
    }
  }

  console.log(`Loaded ${Object.keys(map).length} existing image mappings from item-images.ts.`);

  let newlyAddedCount = 0;
  let overwrittenCount = 0;

  for (const file of pngFiles) {
    const baseName = path.basename(file, '.png');
    const displayName = baseName.replace(/_/g, ' ');
    const webpFileName = `${baseName}.webp`;
    const destPath = path.join(DEST_DIR, webpFileName);
    const srcPath = path.join(SOURCE_DIR, file);

    try {
      const existsBefore = fs.existsSync(destPath);

      // Convert to WebP and save
      await sharp(srcPath)
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(destPath);
      
      if (existsBefore) {
        overwrittenCount++;
      } else {
        newlyAddedCount++;
      }

      // Add to mapping
      map[displayName] = webpFileName;
    } catch (err) {
      console.error(`Failed to process ${file}:`, err.message);
    }
  }

  // Write back alphabetical mappings
  const sortedKeys = Object.keys(map).sort();
  let newMapBody = '\n';
  for (const key of sortedKeys) {
    newMapBody += `  "${key}": "${map[key]}",\n`;
  }

  const newTsContent = tsContent.replace(mapRegex, `export const itemImages: Record<string, string> = {${newMapBody}};`);
  fs.writeFileSync(TS_FILE, newTsContent, 'utf8');

  console.log('\n==================================================');
  console.log('First Batch Integration Complete!');
  console.log(`- Converted and newly added ${newlyAddedCount} icons to WebP.`);
  console.log(`- Overwrote/replaced ${overwrittenCount} existing icons in public/images/items/.`);
  console.log(`- Total mappings now in item-images.ts: ${sortedKeys.length}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error in first batch integration script:', err);
  process.exit(1);
});
