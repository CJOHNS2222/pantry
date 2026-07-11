import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, 'walmart-scraped-ids.json');
const servicePath = path.resolve(__dirname, '../services/groceryCheckoutService.ts');

if (!fs.existsSync(jsonPath)) {
  console.error('❌ Error: walmart-scraped-ids.json not found!');
  process.exit(1);
}

const scrapedData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Format mappings as sorted 'itemName': 'itemId' lines
const formattedLines = Object.keys(scrapedData)
  .sort()
  .map(key => {
    const val = scrapedData[key];
    const id = typeof val === 'object' && val !== null ? val.id : val;
    return `  '${key}': '${id}',`;
  });

const mapReplacement = `export const STAPLE_WALMART_MAP: Record<string, string> = {\n${formattedLines.join('\n')}\n};`;

let serviceContent = fs.readFileSync(servicePath, 'utf8');

// Find the STAPLE_WALMART_MAP declaration block using regex
const mapRegex = /export const STAPLE_WALMART_MAP[\s\S]*?};/;
if (!serviceContent.match(mapRegex)) {
  console.error('❌ Error: Could not locate STAPLE_WALMART_MAP in groceryCheckoutService.ts');
  process.exit(1);
}

serviceContent = serviceContent.replace(mapRegex, mapReplacement);
fs.writeFileSync(servicePath, serviceContent);

console.log(`✅ Successfully merged ${formattedLines.length} product IDs into groceryCheckoutService.ts!`);
