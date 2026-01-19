#!/usr/bin/env node

/**
 * Test script to verify cached popular recipes functionality
 */

import { getCachedPopularRecipes } from '../services/recipeService.js';

async function testCaching() {
  console.log('🧪 Testing cached popular recipes...\n');

  try {
    console.log('1️⃣ First call - should load and cache recipes...');
    const start1 = Date.now();
    const recipes1 = await getCachedPopularRecipes();
    const time1 = Date.now() - start1;

    console.log(`   Loaded ${recipes1.length} recipes in ${time1}ms\n`);

    console.log('2️⃣ Second call - should load from cache (much faster)...');
    const start2 = Date.now();
    const recipes2 = await getCachedPopularRecipes();
    const time2 = Date.now() - start2;

    console.log(`   Loaded ${recipes2.length} recipes in ${time2}ms\n`);

    if (time2 < time1 / 2) {
      console.log('✅ Caching is working! Second call was much faster.');
    } else {
      console.log('⚠️ Caching may not be working - times are similar.');
    }

    console.log(`📊 Performance improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}% faster on second call`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCaching();