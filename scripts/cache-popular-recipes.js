#!/usr/bin/env node

/**
 * Script to cache popular recipes for efficient loading
 * Run this once to populate the cached recipes document
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getCachedPopularRecipes, cachePopularRecipes } from '../services/recipeService.js';

// Initialize Firebase (you might need to adjust the config path)
const firebaseConfig = {
  // Your Firebase config here - copy from your firebaseConfig.ts
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cachePopularRecipesScript() {
  try {
    console.log('Checking for existing cached recipes...');

    // Try to get cached recipes first
    const cachedRecipes = await getCachedPopularRecipes();

    if (cachedRecipes.length > 0) {
      console.log(`Found ${cachedRecipes.length} cached recipes already.`);
      console.log('To refresh cache, delete the system/popular_recipes document first.');
      return;
    }

    console.log('No cached recipes found. Loading and caching popular recipes...');

    // This will automatically cache the recipes via the fallback in getCachedPopularRecipes
    const recipes = await getCachedPopularRecipes();

    console.log(`Successfully cached ${recipes.length} popular recipes!`);
    console.log('The RecipeFinder will now load recipes with just 1 database read instead of 50+.');

  } catch (error) {
    console.error('Error caching popular recipes:', error);
  }
}

cachePopularRecipesScript();