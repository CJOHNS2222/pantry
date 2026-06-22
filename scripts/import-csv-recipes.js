#!/usr/bin/env node

/**
 * CSV Recipe Importer
 * 
 * Parses a recipe CSV exported from web scrapers, utilizes the Gemini API to 
 * infer/reconstruct missing ingredient lists, and uploads them to Firebase Firestore 
 * and the Search Index.
 * 
 * Usage: node scripts/import-csv-recipes.js
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables from .env.local
const envPath = join(projectRoot, '.env.local');
let envVars = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        envVars[key.trim()] = value.slice(1, -1);
      } else {
        envVars[key.trim()] = value;
      }
    }
  });
} catch (error) {
  console.warn('⚠️ Could not load .env.local file:', error.message);
}

// Get API Key and Project ID
const apiKey = envVars.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const projectId = envVars.VITE_PROJECT_ID || process.env.VITE_PROJECT_ID;

if (!apiKey) {
  console.error('❌ VITE_GEMINI_API_KEY is not defined in environment variables.');
  process.exit(1);
}

// Load service account key
const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json:', error.message);
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: projectId
});

const db = getFirestore(app);
const ai = new GoogleGenAI({ apiKey });

const csvPath = join(projectRoot, 'scripts', 'test-data', 'allrecipes-com-2026-06-21-2.csv');

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

function extractKeywords(recipe) {
  const keywords = new Set();
  if (recipe.title) {
    recipe.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }
  if (recipe.ingredients) {
    recipe.ingredients.forEach(ingredient => {
      ingredient.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 2) keywords.add(word);
      });
    });
  }
  if (recipe.type) {
    keywords.add(recipe.type.toLowerCase());
  }
  return Array.from(keywords);
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

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Parse limit
const limitArgIdx = process.argv.indexOf('--limit');
const limit = (limitArgIdx !== -1 && process.argv[limitArgIdx + 1]) ? parseInt(process.argv[limitArgIdx + 1], 10) : null;

async function main() {
  console.log('🚀 Starting CSV Recipe Importer...');
  if (limit !== null) {
    console.log(`⚙️ Running with limit of ${limit} recipes.`);
  }
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV File not found at: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  console.log('Parsing CSV content...');
  const rows = parseCSV(content);
  const headers = rows[0];
  console.log(`Parsed ${rows.length - 1} recipe rows from CSV.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 1; i < rows.length; i++) {
    if (limit !== null && (successCount + failCount) >= limit) {
      console.log(`⏹️ Reached processing limit of ${limit} recipes. Stopping.`);
      break;
    }

    const row = rows[i];
    const title = (row[headers.indexOf('title')] || '').trim();
    if (!title) {
      continue;
    }

    console.log(`\n-----------------------------------------`);
    console.log(`[${i}/${rows.length - 1}] Processing: "${title}"`);

    try {
      // 1. Check duplicate
      const existing = await db.collection('recipes').where('title', '==', title).get();
      if (!existing.empty) {
        console.log(`⏭️  Skipping duplicate recipe: "${title}"`);
        skipCount++;
        continue;
      }

      // 2. Extract values
      const description = (row[headers.indexOf('description')] || '').trim();
      const directionsRaw = (row[headers.indexOf('Directions')] || '').trim();
      
      const instructions = directionsRaw
        .split(/\n\n+/)
        .map(s => s.trim())
        .filter(s => s);

      if (instructions.length === 0) {
        console.log(`⚠️  Skipping recipe "${title}" due to empty directions.`);
        skipCount++;
        continue;
      }

      const imageUrl = extractImageUrl(row, headers);
      const sourceUrl = row[headers.indexOf('item_page_link')] || row[headers.indexOf('web_scraper_start_url')] || '';
      const category = getCategory(row, headers);
      const tags = getTags(row, headers);

      // Extract calories
      const caloriesRaw = row[headers.indexOf('calories')] || '';
      let calories = null;
      const calMatch = caloriesRaw.match(/\d+/);
      if (calMatch) {
        calories = parseInt(calMatch[0], 10);
      }

      // 3. Request Gemini to infer ingredients, prep/cook time, and servings
      console.log(`🔮 Inferring ingredients list via Gemini AI...`);
      
      const prompt = `You are a professional chef. Given the following recipe details, extract the list of ingredients with their quantities and units. If the quantities/units are mentioned in the directions but not explicitly listed, reconstruct them.
Return a JSON object matching this schema:
{
  "ingredients": ["string"],
  "prepTime": "string (e.g. '15 mins')",
  "cookTime": "string (e.g. '30 mins')",
  "servings": number (integer, or null if unknown)
}

Recipe Details:
Title: ${title}
Description: ${description}
Directions:
${instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}
`;

      let attempt = 0;
      let responseText = '';
      while (attempt < 3) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });
          responseText = response.text;
          break;
        } catch (err) {
          attempt++;
          if (attempt >= 3) throw err;
          console.warn(`⚠️ Rate limit or transient error hit. Retrying in 10s (attempt ${attempt}/3)...`);
          await wait(10000);
        }
      }

      const inferred = JSON.parse(responseText);
      const ingredients = inferred.ingredients || [];
      const prepTime = inferred.prepTime || null;
      const cookTime = inferred.cookTime || '30 mins';
      const servings = inferred.servings || null;

      if (ingredients.length === 0) {
        throw new Error('Gemini returned an empty ingredients list.');
      }

      console.log(`✨ Inferred ${ingredients.length} ingredients.`);

      // 4. Save Recipe Document
      const recipeDocRef = db.collection('recipes').doc();
      const recipeId = recipeDocRef.id;

      const recipeObj = {
        title,
        description: description || null,
        ingredients,
        instructions,
        cookTime,
        prepTime,
        servings,
        type: category,
        tags,
        image: imageUrl,
        source: 'Allrecipes',
        sourceUrl,
        dateSaved: new Date().toISOString()
      };

      if (calories !== null) {
        recipeObj.nutrition = {
          calories
        };
      }

      await recipeDocRef.set(recipeObj);

      // 5. Save Search Index Document
      const searchEntry = {
        id: recipeId,
        title,
        description: description || '',
        ingredients,
        cookTime,
        type: category,
        dateSaved: recipeObj.dateSaved,
        searchText: [
          title,
          description || '',
          ...ingredients
        ].join(' ').toLowerCase(),
        keywords: extractKeywords(recipeObj)
      };

      await db.collection('recipe_search_index').doc(recipeId).set(searchEntry);

      console.log(`✅ Imported and indexed: "${title}"`);
      successCount++;

      // Delay to respect Gemini API rate limits (15 RPM -> 4.5s delay)
      await wait(4500);

    } catch (e) {
      console.error(`❌ Failed to import recipe "${title}":`, e.message);
      failCount++;
      // Wait a bit on error before continuing
      await wait(2000);
    }
  }

  console.log(`\n=========================================`);
  console.log(`🏁 CSV Recipe Import Completed!`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`=========================================`);

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error in importer script:', err);
  process.exit(1);
});
