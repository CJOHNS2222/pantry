import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const csvPath = join(projectRoot, 'scripts', 'test-data', 'allrecipes-com-2026-06-21-2.csv');
const outputPath = join(projectRoot, 'scripts', 'test-data', 'recipes_to_enrich.json');

function parseCSV(content) {
  const lines = [];
  let currentField = '';
  let inQuotes = false;
  let currentRow = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      lines.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }
  return lines;
}

function extractImageUrl(row, headers) {
  const candidates = ['image_3', 'image_1', 'item_page_title', 'image'];
  for (const col of candidates) {
    const idx = headers.indexOf(col);
    if (idx !== -1 && row[idx]) {
      const val = row[idx].trim();
      if (val.startsWith('http')) {
        return val;
      }
      const imgMatch = val.match(/src="([^"]+)"/);
      if (imgMatch) {
        return imgMatch[1];
      }
    }
  }
  return null;
}

function getCategory(row, headers) {
  const breadcrumbsIdx = headers.indexOf('breadcrumbs');
  const BreadcrumbsIdx = headers.indexOf('Breadcrumbs');
  const val = (breadcrumbsIdx !== -1 && row[breadcrumbsIdx]) || (BreadcrumbsIdx !== -1 && row[BreadcrumbsIdx]) || '';
  const parts = val.split('\n').map(p => p.trim()).filter(p => p && p.toLowerCase() !== 'recipes');
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  return 'Dinner';
}

function getTags(row, headers) {
  const breadcrumbsIdx = headers.indexOf('breadcrumbs');
  const BreadcrumbsIdx = headers.indexOf('Breadcrumbs');
  const val = (breadcrumbsIdx !== -1 && row[breadcrumbsIdx]) || (BreadcrumbsIdx !== -1 && row[BreadcrumbsIdx]) || '';
  const parts = val.split('\n').map(p => p.trim()).filter(p => p && p.toLowerCase() !== 'recipes');
  return Array.from(new Set(parts));
}

function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);
  const headers = rows[0];

  const recipes = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = (row[headers.indexOf('title')] || '').trim();
    if (!title) continue;

    const description = (row[headers.indexOf('description')] || '').trim();
    const directionsRaw = (row[headers.indexOf('Directions')] || '').trim();
    
    const instructions = directionsRaw
      .split(/\n\n+/)
      .map(s => s.trim())
      .filter(s => s);

    if (instructions.length === 0) continue;

    const imageUrl = extractImageUrl(row, headers);
    const sourceUrl = row[headers.indexOf('item_page_link')] || row[headers.indexOf('web_scraper_start_url')] || '';
    const category = getCategory(row, headers);
    const tags = getTags(row, headers);

    const caloriesRaw = row[headers.indexOf('calories')] || '';
    let calories = null;
    const calMatch = caloriesRaw.match(/\d+/);
    if (calMatch) {
      calories = parseInt(calMatch[0], 10);
    }

    recipes.push({
      title,
      description: description || null,
      instructions,
      imageUrl,
      sourceUrl,
      category,
      tags,
      calories
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));
  console.log(`Successfully converted ${recipes.length} recipes to ${outputPath}`);
}

main();
