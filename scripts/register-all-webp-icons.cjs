const fs = require('fs');
const path = require('path');

const DEST_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const TS_FILE = path.join(__dirname, '..', 'data', 'item-images.ts');

async function main() {
  if (!fs.existsSync(DEST_DIR)) {
    console.error(`Destination directory does not exist: ${DEST_DIR}`);
    return;
  }

  // 1. Read existing mappings from data/item-images.ts
  let tsContent = fs.readFileSync(TS_FILE, 'utf8');
  const mapRegex = /export\s+const\s+itemImages:\s+Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/;
  const match = tsContent.match(mapRegex);
  if (!match) {
    console.error('Could not parse itemImages map in data/item-images.ts');
    return;
  }

  const existingMapBody = match[1];
  const map = {};
  const mappedFiles = new Set();

  const lines = existingMapBody.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    
    const kvMatch = trimmed.match(/^["']([^"']+)["']\s*:\s*["']([^"']+)["']\s*,?$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2];
      map[key] = val;
      mappedFiles.add(val);
    }
  }

  console.log(`Loaded ${Object.keys(map).length} existing image mappings from item-images.ts.`);

  // 2. Scan public/images/items/ for WebP, PNG, and SVG files
  const files = fs.readdirSync(DEST_DIR)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.webp' || ext === '.png' || ext === '.svg';
    });

  console.log(`Found ${files.length} image files in public/images/items/.`);

  let addedCount = 0;

  // 3. Register any files that are not already mapped
  for (const file of files) {
    if (mappedFiles.has(file)) {
      continue; // Already mapped
    }

    // Generate a display name key from the filename
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const displayName = baseName.replace(/_/g, ' '); // e.g. "canned_black_beans" -> "canned black beans"

    // Check if the display name is already mapped to something else
    if (map[displayName]) {
      // Name is already taken, let's keep the existing mapping to avoid overwriting custom ones
      continue;
    }

    // Add new mapping
    map[displayName] = file;
    mappedFiles.add(file);
    addedCount++;
  }

  // 4. Write back the updated data/item-images.ts sorted alphabetically by key
  const sortedKeys = Object.keys(map).sort();
  let newMapBody = '\n';
  for (const key of sortedKeys) {
    newMapBody += `  "${key}": "${map[key]}",\n`;
  }

  const newTsContent = tsContent.replace(mapRegex, `export const itemImages: Record<string, string> = {${newMapBody}};`);
  fs.writeFileSync(TS_FILE, newTsContent, 'utf8');

  console.log('\n==================================================');
  console.log('WebP Registration Complete!');
  console.log(`- Registered ${addedCount} new icons to item-images.ts.`);
  console.log(`- Total mappings now in item-images.ts: ${sortedKeys.length}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error in registration script:', err);
  process.exit(1);
});
