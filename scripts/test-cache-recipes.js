#!/usr/bin/env node

/**
 * Simple script to test and populate cached popular recipes
 * Run with: node scripts/test-cache-recipes.js
 */

import { getCachedPopularRecipes } from '../services/recipeService.js';

async function testCachedRecipes() {
  try {
    console.log('Testing cached popular recipes...');

    const startTime = Date.now();
    const recipes = await getCachedPopularRecipes();
    const endTime = Date.now();

    console.log(`Loaded ${recipes.length} recipes in ${endTime - startTime}ms`);

    if (recipes.length > 0) {
      console.log('Sample recipes:');
      recipes.slice(0, 3).forEach((recipe, i) => {
        console.log(`  ${i + 1}. ${recipe.title}`);
      });
      console.log('✅ Cached recipes working! Should see ~1 database read instead of 50+');
    } else {
      console.log('❌ No recipes loaded');
    }

  } catch (error) {
    console.error('Error testing cached recipes:', error);
  }
}

testCachedRecipes();