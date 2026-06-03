#!/usr/bin/env node

/**
 * Script to rebuild the community-rated recipes cache
 * This ensures that rated recipes display their images in the Community tab
 */

import { rebuildCommunityRatedRecipesFromRatings } from '../services/recipeService.js';

async function main() {
  try {
    console.log('🔄 Rebuilding community-rated recipes cache...');
    await rebuildCommunityRatedRecipesFromRatings();
    console.log('✅ Community cache rebuilt successfully!');
    console.log('📱 Rated recipes should now display their images in the Community tab.');
  } catch (error) {
    console.error('❌ Failed to rebuild community cache:', error);
    process.exit(1);
  }
}

main();