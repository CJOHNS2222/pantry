/**
 * generate-walmart-ids.js
 * 
 * A local utility script to automatically query and extract valid Walmart Item IDs
 * for a list of common shopping list ingredients using either DuckDuckGo HTML scraping
 * (completely free) or Google Custom Search API (capped to 75 requests to prevent fees).
 * 
 * Usage:
 *   node scripts/generate-walmart-ids.js --engine ddg     (Free, unlimited, parses search HTML)
 *   node scripts/generate-walmart-ids.js --engine google  (Uses your Google CSE key in .env.local, max 75 items)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Seed list of common ingredients to resolve
const INGREDIENTS = [
  'chicken breast', 'chicken thighs', 'ground beef', 'steak', 'pork chops',
  'salmon', 'shrimp', 'canned tuna', 'bacon', 'sausage',
  'tofu', 'black beans', 'chickpeas', 'milk', 'butter',
  'cheese', 'cheddar cheese', 'mozzarella', 'cream cheese', 'sour cream',
  'yogurt', 'greek yogurt', 'almond milk', 'oat milk', 'eggs',
  'banana', 'apple', 'orange', 'strawberry', 'blueberries',
  'avocado', 'lemon', 'lime', 'onion', 'garlic',
  'potato', 'sweet potato', 'tomato', 'tomatoes', 'broccoli',
  'spinach', 'bell pepper', 'cucumber', 'carrot', 'celery',
  'mushroom', 'lettuce', 'cilantro', 'green onion', 'ginger',
  'sugar', 'brown sugar', 'flour', 'honey', 'maple syrup',
  'bread', 'rice', 'jasmine rice', 'oats', 'pasta',
  'spaghetti', 'olive oil', 'vegetable oil', 'salt', 'black pepper',
  'soy sauce', 'ketchup', 'mustard', 'mayonnaise', 'hot sauce'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Edge/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

// Helper to load env variables from .env.local manually
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index !== -1) {
      const key = trimmed.substring(0, index).trim();
      const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
  return env;
}

const env = loadEnv();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2);
  const engineIndex = args.indexOf('--engine');
  let engine = 'ddg';
  if (engineIndex !== -1 && args[engineIndex + 1]) {
    engine = args[engineIndex + 1].toLowerCase();
  }

  console.log(`🚀 Starting Walmart ID extractor...`);
  console.log(`🤖 Search Engine: ${engine.toUpperCase()}`);

  const outputPath = path.resolve(__dirname, 'walmart-scraped-ids.json');
  let existingResults = {};
  if (fs.existsSync(outputPath)) {
    try {
      existingResults = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log(`📂 Loaded ${Object.keys(existingResults).length} existing matches from ${path.basename(outputPath)}`);
    } catch (e) {
      console.log('⚠️ Could not parse existing walmart-scraped-ids.json, starting fresh.');
    }
  }

  // Load search list from new-items.txt if it exists, otherwise fall back to default INGREDIENTS seed list
  const inputFilePath = path.resolve(__dirname, 'new-items.txt');
  let searchList = [...INGREDIENTS];
  if (fs.existsSync(inputFilePath)) {
    try {
      const fileContent = fs.readFileSync(inputFilePath, 'utf8');
      const customItems = fileContent
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      if (customItems.length > 0) {
        searchList = customItems;
        console.log(`📋 Loaded ${customItems.length} custom search items from ${path.basename(inputFilePath)}`);
      }
    } catch (e) {
      console.log('⚠️ Could not read new-items.txt, falling back to default seed list.');
    }
  }

  // Clone existing results to merge and preserve matches
  const results = { ...existingResults };

  const forceAll = args.includes('--all');
  let itemsToProcess = searchList.filter(item => {
    if (forceAll) return true;
    const existing = existingResults[item];
    if (!existing || !existing.id) return true;
    
    // If using Google search, we want to retry items that don't have images
    if (engine === 'google' && !existing.image) return true;
    
    return false;
  });

  if (itemsToProcess.length === 0) {
    console.log(`✨ All ${searchList.length} items are already resolved. Nothing to do! (Pass --all to force recalculating).`);
    process.exit(0);
  }

  console.log(`📝 Processing ${itemsToProcess.length} items...`);

  if (engine === 'google') {
    const apiKey = env.VITE_GOOGLE_CSE_API_KEY;
    const cseId = env.VITE_GOOGLE_CSE_ID;

    if (!apiKey) {
      console.error('❌ Error: VITE_GOOGLE_CSE_API_KEY not found in .env.local');
      process.exit(1);
    }

    console.log(`⚠️ Capping Google search to 75 items to prevent API charges.`);
    itemsToProcess = itemsToProcess.slice(0, 75);

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      console.log(`[${i + 1}/${itemsToProcess.length}] Searching Google for: "${item}"...`);
      try {
        const query = encodeURIComponent(`site:walmart.com/ip Great Value ${item}`);
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${query}&num=1`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        
        const data = await res.json();
        const firstResult = data.items?.[0];
        const firstResultUrl = firstResult?.link;

        if (firstResultUrl) {
          const idMatch = firstResultUrl.match(/\/ip\/(?:[^\/]+\/)?(\d+)/i);
          if (idMatch && idMatch[1]) {
            const itemId = idMatch[1];
            // Extract the main product image from Google's rich snippet metadata
            const imageUrl = firstResult.pagemap?.cse_image?.[0]?.src || 
                             firstResult.pagemap?.cse_thumbnail?.[0]?.src || 
                             null;

            results[item] = {
              id: itemId,
              image: imageUrl
            };
            console.log(`   ✅ Found ID: ${itemId}`);
            if (imageUrl) {
              console.log(`   🖼️  Image: ${imageUrl.substring(0, 60)}...`);
            }
          } else {
            console.log(`   ❌ No ID pattern in result: ${firstResultUrl}`);
          }
        } else {
          console.log(`   ❌ No search results found.`);
        }
      } catch (err) {
        console.error(`   ❌ Search failed:`, err.message);
      }
      // Small delay between API requests
      await sleep(100);
    }

  } else {
    // DuckDuckGo Free HTML Scraping
    console.log(`ℹ️ DuckDuckGo scraping enabled. Running with randomized 4-7s delay and rotated User-Agents.`);
    
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      console.log(`[${i + 1}/${itemsToProcess.length}] Querying DDG for: "${item}"...`);
      try {
        const query = encodeURIComponent(`walmart Great Value ip ${item}`);
        const url = `https://html.duckduckgo.com/html/?q=${query}`;
        
        // Select a random user agent to mimic different browsers
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        
        const res = await fetch(url, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://html.duckduckgo.com/'
          }
        });

        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        
        const html = await res.text();
        
        // Extract page title to verify if we are being blocked/rate-limited
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].trim() : 'Unknown Title';
        
        // Extract all links in the page
        const hrefMatches = html.match(/href=["']([^"']+)["']/gi) || [];
        let foundId = null;

        for (const hrefAttr of hrefMatches) {
          // Extract the URL from the href attribute
          const urlPart = hrefAttr.replace(/href=["']/i, '').slice(0, -1);
          try {
            const decodedUrl = decodeURIComponent(urlPart);
            const idMatch = decodedUrl.match(/walmart\.com\/ip\/(?:[^\/]+\/)?(\d+)/i);
            if (idMatch && idMatch[1]) {
              foundId = idMatch[1];
              break;
            }
          } catch (e) {
            // Ignore malformed URL parameters
          }
        }

        if (foundId) {
          results[item] = {
            id: foundId,
            image: null
          };
          console.log(`   ✅ Found ID: ${foundId}`);
        } else {
          console.log(`   ❌ No ID found. Page Title: "${pageTitle}" (Total links inspected: ${hrefMatches.length})`);
        }
      } catch (err) {
        console.error(`   ❌ Query failed:`, err.message);
      }

      // Add a randomized delay (4-7s) to be extremely human-like and avoid blocks
      if (i < itemsToProcess.length - 1) {
        const delay = 4000 + Math.random() * 3000;
        console.log(`   ⏳ Sleeping for ${(delay / 1000).toFixed(1)}s...`);
        await sleep(delay);
      }
    }
  }

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n🎉 Success! Results written to:`);
  console.log(`   ${outputPath}`);
  console.log(`   Found ${Object.keys(results).length} product matches.`);
}

main();
