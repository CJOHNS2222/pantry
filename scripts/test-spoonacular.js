#!/usr/bin/env node

/**
 * Test Spoonacular API Connection
 * Usage: node scripts/test-spoonacular.js
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').filter(line => line.includes('='));
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      process.env[key.trim()] = value;
    }
  });
} catch (error) {
  console.error('Could not load .env.local file:', error.message);
}

const SPOONACULAR_API_KEY = process.env.VITE_SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";

async function fetchRecipesFromSpoonacular(query = "chicken", number = 2, offset = 0) {
  if (!SPOONACULAR_API_KEY) {
    throw new Error("Spoonacular API key not configured");
  }

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: number.toString(),
    offset: offset.toString(),
    addRecipeInformation: "true",
    fillIngredients: "true"
  });

  if (query) {
    params.append("query", query);
  }

  const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || [];
}

async function testSpoonacularConnection() {
  console.log('🧪 Testing Spoonacular API connection...');

  try {
    console.log('📡 Fetching test recipes for "chicken"...');
    const recipes = await fetchRecipesFromSpoonacular('chicken', 2);

    console.log(`✅ Successfully fetched ${recipes.length} recipes:`);
    recipes.forEach((recipe, index) => {
      console.log(`   ${index + 1}. ${recipe.title} (${recipe.readyInMinutes} mins)`);
    });

    console.log('\n🎉 Spoonacular API is working correctly!');
    console.log('🚀 You can now run the bulk upload script: npm run bulk-upload-recipes');

  } catch (error) {
    console.error('❌ Spoonacular API test failed:', error.message);

    if (error.message.includes('API key')) {
      console.log('\n🔑 Please check your VITE_SPOONACULAR_API_KEY in .env.local');
      console.log('   Get your free API key at: https://spoonacular.com/food-api');
    } else if (error.message.includes('rate limit')) {
      console.log('\n⏱️  You may have exceeded the free tier rate limit (150 requests/day)');
      console.log('   Try again tomorrow or upgrade your plan');
    } else if (error.message.includes('404')) {
      console.log('\n🔍 API endpoint not found. The Spoonacular API may have changed.');
      console.log('   Check their documentation: https://spoonacular.com/food-api/docs');
    }

    process.exit(1);
  }
}

// Check if API key is configured
if (!SPOONACULAR_API_KEY) {
  console.error('❌ VITE_SPOONACULAR_API_KEY environment variable not set');
  console.log('Please add your Spoonacular API key to your .env.local file:');
  console.log('VITE_SPOONACULAR_API_KEY=your_api_key_here');
  process.exit(1);
}

testSpoonacularConnection().catch(console.error);