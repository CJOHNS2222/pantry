#!/usr/bin/env node

/**
 * Allrecipes JSON-LD Scraper
 *
 * Scrapes structured recipe data from Allrecipes.com using Puppeteer Stealth,
 * parses JSON-LD metadata, and saves it to Firestore and the search index.
 *
 * Usage:
 *   node scripts/scrape-allrecipes.js --url "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"
 *   node scripts/scrape-allrecipes.js --file urls.txt
 *   node scripts/scrape-allrecipes.js --url <url> --download-images
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env.local');

let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
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
  console.error('❌ Could not load .env.local file:', error.message);
  process.exit(1);
}

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Use Stealth plugin to bypass Cloudflare protection
puppeteer.use(StealthPlugin());

// Load service account key
const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('❌ Could not load firebase-service-account.json');
  process.exit(1);
}

// Initialize Firebase Admin App
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: envVars.VITE_PROJECT_ID || process.env.VITE_PROJECT_ID
});

const db = getFirestore(app);
const storage = getStorage(app);

// Parse Command Line Arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    urls: [],
    downloadImages: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      options.urls.push(args[++i].trim());
    } else if (arg === '--file' && args[i + 1]) {
      const filepath = args[++i].trim();
      try {
        const fileContent = readFileSync(filepath, 'utf8');
        const fileUrls = fileContent.split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('http'));
        options.urls.push(...fileUrls);
        console.log(`📖 Loaded ${fileUrls.length} URL(s) from ${filepath}`);
      } catch (err) {
        console.error(`❌ Could not read file ${filepath}:`, err.message);
      }
    } else if (arg === '--download-images') {
      options.downloadImages = true;
    }
  }

  return options;
}

// Parse ISO 8601 Durations (e.g. PT30M -> 30 mins)
function parseISO8601Duration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return null;
  const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!matches) return null;
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

// Extract search index keywords
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

// Search JSON-LD schemas for the Recipe object
function findRecipeObject(data) {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeObject(item);
      if (found) return found;
    }
  } else if (data && typeof data === 'object') {
    if (data['@type'] === 'Recipe' || (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
      return data;
    }
    if (data['@graph'] && Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        const found = findRecipeObject(item);
        if (found) return found;
      }
    }
  }
  return null;
}

// Parse Instructions from various JSON-LD forms
function parseInstructions(instructions) {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return [instructions.trim()];
  }
  if (Array.isArray(instructions)) {
    const steps = [];
    for (const inst of instructions) {
      if (typeof inst === 'string') {
        steps.push(inst.trim());
      } else if (inst && typeof inst === 'object') {
        if (inst['@type'] === 'HowToStep' && inst.text) {
          steps.push(inst.text.trim());
        } else if (inst['@type'] === 'HowToSection' && Array.isArray(inst.itemListElement)) {
          for (const step of inst.itemListElement) {
            if (step && step.text) {
              steps.push(step.text.trim());
            } else if (typeof step === 'string') {
              steps.push(step.trim());
            }
          }
        } else if (inst.text) {
          steps.push(inst.text.trim());
        }
      }
    }
    return steps.filter(Boolean);
  }
  return [];
}

// Extract raw URL from Image JSON-LD representations
function extractImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    if (image.length === 0) return null;
    const first = image[0];
    return typeof first === 'string' ? first : first?.url || null;
  }
  if (typeof image === 'object') {
    return image.url || null;
  }
  return null;
}

// Download image and upload to Firebase Storage
async function downloadAndUploadImage(imageUrl, recipeId) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const destFile = bucket.file(`recipes/${recipeId}.jpg`);
    await destFile.save(buffer, {
      metadata: { contentType: 'image/jpeg' }
    });

    // Make public and obtain download URL
    await destFile.makePublic();
    return destFile.publicUrl();
  } catch (error) {
    console.warn(`⚠️ Image download failed for ${imageUrl}:`, error.message);
    return imageUrl; // Fall back to original external URL
  }
}

// Main processing logic
async function main() {
  const options = parseArgs();

  if (options.urls.length === 0) {
    console.error('❌ No recipe URLs provided. Specify at least one URL with --url <url> or a file with --file <file.txt>');
    process.exit(1);
  }

  console.log(`🚀 Starting Allrecipes Scraper...`);
  console.log(`🔗 Found ${options.urls.length} target URL(s) to process.`);
  if (options.downloadImages) {
    console.log(`💾 Image downloading is ENABLED. Images will be saved to Firebase Storage.`);
  } else {
    console.log(`🔗 Image downloading is DISABLED. Images will use original CDN links.`);
  }

  console.log('\nStarting browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < options.urls.length; idx++) {
    const url = options.urls[idx];
    console.log(`\n-----------------------------------------`);
    console.log(`[${idx + 1}/${options.urls.length}] Processing: ${url}`);

    try {
      // Navigate to URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Wait a moment for Cloudflare or redirects
      await new Promise(r => setTimeout(r, 2000));

      const title = await page.title();
      if (title.includes('Just a moment')) {
        console.log('⏳ Page is stuck on Cloudflare challenge. Waiting up to 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));
      }

      // Find JSON-LD script blocks
      const jsonLdContents = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        return scripts.map(s => s.textContent);
      });

      if (jsonLdContents.length === 0) {
        throw new Error('No JSON-LD metadata found on page.');
      }

      // Find Recipe object inside parsed JSON-LD
      let rawRecipeObj = null;
      for (const text of jsonLdContents) {
        try {
          const parsed = JSON.parse(text);
          rawRecipeObj = findRecipeObject(parsed);
          if (rawRecipeObj) break;
        } catch {
          // Ignore parse errors from invalid blocks
        }
      }

      if (!rawRecipeObj) {
        throw new Error('Could not find Recipe schema object in JSON-LD blocks.');
      }

      // Map details to database format
      const name = rawRecipeObj.name || await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() || null);
      if (!name) {
        throw new Error('Recipe has no title/name.');
      }

      // Check if it exists
      const existing = await db.collection('recipes').where('title', '==', name).get();
      if (!existing.empty) {
        console.log(`⏭️  Skipping duplicate recipe: "${name}"`);
        skipCount++;
        continue;
      }

      const description = rawRecipeObj.description?.replace(/<[^>]*>/g, '') || null;
      const ingredients = rawRecipeObj.recipeIngredient || [];
      const instructions = parseInstructions(rawRecipeObj.recipeInstructions);

      if (ingredients.length === 0 || instructions.length === 0) {
        throw new Error(`Incomplete recipe content: ${ingredients.length} ingredients, ${instructions.length} steps.`);
      }

      const prepTime = parseISO8601Duration(rawRecipeObj.prepTime);
      const cookTime = parseISO8601Duration(rawRecipeObj.cookTime) || '30 mins';
      const totalTime = parseISO8601Duration(rawRecipeObj.totalTime);

      const category = Array.isArray(rawRecipeObj.recipeCategory)
        ? rawRecipeObj.recipeCategory[0]
        : (typeof rawRecipeObj.recipeCategory === 'string' ? rawRecipeObj.recipeCategory : 'Dinner');

      // Extract image URL
      const extImageUrl = extractImageUrl(rawRecipeObj.image);

      // Create unique ID for storage reference
      const recipeDocRef = db.collection('recipes').doc();
      const recipeId = recipeDocRef.id;

      // Handle image downloading if enabled
      let finalImageUrl = extImageUrl;
      if (options.downloadImages && extImageUrl) {
        console.log(`📸 Downloading image: ${extImageUrl}`);
        finalImageUrl = await downloadAndUploadImage(extImageUrl, recipeId);
      }

      // Save Recipe Document
      const recipeObj = {
        title: name,
        description: description,
        ingredients: ingredients,
        instructions: instructions,
        cookTime: cookTime,
        type: category || 'Dinner',
        image: finalImageUrl,
        source: 'Allrecipes',
        sourceUrl: url,
        dateSaved: new Date().toISOString(),
        prepTime: prepTime,
        totalTime: totalTime
      };

      await recipeDocRef.set(recipeObj);

      // Save Search Index Document
      const searchEntry = {
        id: recipeId,
        title: name,
        description: description || '',
        ingredients: ingredients,
        cookTime: cookTime,
        type: category || 'Dinner',
        dateSaved: recipeObj.dateSaved,
        searchText: [
          name,
          description || '',
          ...ingredients
        ].join(' ').toLowerCase(),
        keywords: extractKeywords(recipeObj)
      };

      await db.collection('recipe_search_index').doc(recipeId).set(searchEntry);

      console.log(`✅ Saved recipe and indexed: "${name}"`);
      successCount++;

    } catch (e) {
      console.error(`❌ Failed to scrape recipe:`, e.message);
      failCount++;
    }
  }

  await browser.close();

  console.log(`\n=========================================`);
  console.log(`🏁 Allrecipes Scraping Completed!`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`=========================================`);

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error in scraper script:', err);
  process.exit(1);
});
