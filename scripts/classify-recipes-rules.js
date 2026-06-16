#!/usr/bin/env node

/**
 * Script to classify recipes in recipe_caches using rule-based keyword matching.
 * This runs locally and instantly, with no external dependencies on AI models.
 *
 * Usage:
 *   node scripts/classify-recipes-rules.js            # classify all unclassified
 *   node scripts/classify-recipes-rules.js --force    # re-classify everything
 *   node scripts/classify-recipes-rules.js --dry-run  # preview classifications without saving
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// -- CLI flags
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');

// -- Keyword Rules
const MEAL_TYPE_RULES = [
  { type: 'breakfast', keywords: ['pancake', 'waffle', 'oatmeal', 'oat', 'egg', 'bacon', 'sausage', 'toast', 'scrambled', 'omelette', 'crepe', 'muffin', 'granola', 'smoothie', 'breakfast', 'brunch', 'hashbrown', 'bagel', 'frittata', 'french toast', 'cereal', 'waffles', 'pancakes', 'eggs'] },
  { type: 'lunch', keywords: ['sandwich', 'wrap', 'salad', 'soup', 'panini', 'burger', 'taco', 'quesadilla', 'hummus', 'roll', 'bento', 'lunch', 'sub', 'blt', 'sandwiches', 'tacos', 'quesadillas', 'salads', 'soups'] },
  { type: 'dinner', keywords: ['roast', 'pasta', 'spaghetti', 'curry', 'lasagna', 'steak', 'casserole', 'chicken breast', 'salmon', 'pork chop', 'beef', 'chili', 'stew', 'enchilada', 'stir fry', 'dinner', 'pizza', 'meatloaf', 'meatball', 'parmesan', 'chicken', 'shrimp', 'fish', 'pot roast', 'curries', 'lasagne'] }
];

const CUISINE_RULES = [
  { cuisine: 'italian', keywords: ['pasta', 'spaghetti', 'lasagna', 'parmesan', 'pesto', 'risotto', 'pizza', 'gnocchi', 'tuscan', 'marinara', 'bolognese', 'italian', 'lasagne', 'mozzarella', 'carbonara', 'alfredo', 'basil', 'oregano'] },
  { cuisine: 'mexican', keywords: ['taco', 'burrito', 'quesadilla', 'enchilada', 'salsa', 'guacamole', 'fajita', 'jalapeno', 'cilantro', 'mexican', 'tacos', 'burritos', 'fajitas', 'tortilla', 'tortillas', 'black bean', 'black beans', 'avocado'] },
  { cuisine: 'greek', keywords: ['feta', 'tzatziki', 'greek', 'gyro', 'souvlaki', 'kalamata', 'cucumber', 'dill'] },
  { cuisine: 'american', keywords: ['burger', 'slider', 'barbecue', 'bbq', 'meatloaf', 'mac and cheese', 'american', 'hot dog', 'buffalo wing', 'burgers', 'slaw', 'macaroni', 'ribs', 'potato salad', 'cheddar'] },
  { cuisine: 'chinese', keywords: ['stir fry', 'chow mein', 'fried rice', 'kung pao', 'szechuan', 'dim sum', 'dumpling', 'chinese', 'sweet and sour', 'orange chicken', 'wonton', 'dumplings', 'soy sauce', 'sesame oil'] },
  { cuisine: 'japanese', keywords: ['sushi', 'ramen', 'teriyaki', 'tempura', 'miso', 'udon', 'katsu', 'japanese', 'mirin', 'nori', 'wasabi'] },
  { cuisine: 'indian', keywords: ['curry', 'tikka', 'masala', 'naan', 'tandoori', 'korma', 'paneer', 'biryani', 'indian', 'lentil', 'dal', 'samosa', 'curries', 'turmeric', 'cumin', 'garam masala', 'ginger'] },
  { cuisine: 'french', keywords: ['quiche', 'crepe', 'croissant', 'ratatouille', 'coq au vin', 'french', 'crepes', 'butter', 'wine', 'tarragon'] },
  { cuisine: 'thai', keywords: ['pad thai', 'thai', 'coconut milk', 'curry paste', 'lemongrass', 'fish sauce', 'peanut sauce'] },
  { cuisine: 'mediterranean', keywords: ['hummus', 'falafel', 'couscous', 'mediterranean', 'chickpeas', 'chickpea', 'tahini', 'olive oil'] },
  { cuisine: 'spanish', keywords: ['paella', 'tapas', 'chorizo', 'sangria', 'spanish', 'saffron', 'pimenton'] },
  { cuisine: 'middle eastern', keywords: ['kebab', 'shawarma', 'middle eastern', 'pita', 'shakshuka', 'sumac', 'zaatar'] },
  { cuisine: 'korean', keywords: ['kimchi', 'bulgogi', 'bibimbap', 'gochujang', 'korean', 'sesame seed', 'scallion'] }
];

// -- Load env
const envVars = {};
try {
  readFileSync(join(projectRoot, '.env.local'), 'utf8')
    .split('\n')
    .forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    });
} catch {
  console.error('❌ Could not read .env.local');
  process.exit(1);
}

// -- Firebase Admin
let app;
try {
  const saPath = join(projectRoot, 'firebase-service-account.json');
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  app = initializeApp({ credential: cert(sa), projectId: envVars.VITE_PROJECT_ID });
} catch (e) {
  console.error('❌ Firebase init failed:', e.message);
  process.exit(1);
}
const db = getFirestore(app);

// -- Classification helper
function classifyRecipe(recipe) {
  const title = (recipe.title || '').toLowerCase();
  const desc = (recipe.description || '').toLowerCase();
  const ingredients = Array.isArray(recipe.ingredients) 
    ? recipe.ingredients.map(i => i.toLowerCase()).join(' ') 
    : '';

  const countMatches = (keyword, text) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  };

  // 1. Meal Type Classification
  let bestMealType = 'dinner'; // default
  let maxMealScore = 0;

  MEAL_TYPE_RULES.forEach(rule => {
    let score = 0;
    rule.keywords.forEach(keyword => {
      score += countMatches(keyword, title) * 10;
      score += countMatches(keyword, desc) * 3;
      
      // Exclude egg/eggs from ingredients count to avoid false breakfast match on dinner/lunch recipes
      if (rule.type === 'breakfast' && (keyword === 'egg' || keyword === 'eggs')) {
        return; 
      }
      
      score += countMatches(keyword, ingredients) * 1;
    });

    if (score > maxMealScore) {
      maxMealScore = score;
      bestMealType = rule.type;
    }
  });

  // Title overrides for mealType
  if (title.includes('salad') || title.includes('sandwich') || title.includes('wrap') || title.includes('panini') || title.includes('bento')) {
    bestMealType = 'lunch';
  } else if (title.includes('pancake') || title.includes('waffle') || title.includes('oatmeal') || title.includes('omelette') || title.includes('scrambled egg') || title.includes('french toast') || title.includes('granola')) {
    bestMealType = 'breakfast';
  } else if (title.includes('soup') || title.includes('chili') || title.includes('stew')) {
    // soups/stews can be lunch or dinner, but let's classify as lunch unless it has heavy dinner keywords
    if (!title.includes('chicken') && !title.includes('beef') && !title.includes('pork')) {
      bestMealType = 'lunch';
    }
  }

  // 2. Cuisine Classification
  let bestCuisine = 'other'; // default
  let maxCuisineScore = 0;

  CUISINE_RULES.forEach(rule => {
    let score = 0;
    rule.keywords.forEach(keyword => {
      score += countMatches(keyword, title) * 10;
      score += countMatches(keyword, desc) * 3;
      score += countMatches(keyword, ingredients) * 1;
    });

    if (score > maxCuisineScore) {
      maxCuisineScore = score;
      bestCuisine = rule.cuisine;
    }
  });

  // Title-level direct overrides for cuisine (highest priority)
  if (title.includes('turkish') || title.includes('syrian') || title.includes('lebanese') || title.includes('persian') || title.includes('middle eastern')) {
    bestCuisine = 'middle eastern';
  } else if (title.includes('jamaican') || title.includes('jerk') || title.includes('caribbean')) {
    bestCuisine = 'other';
  } else if (title.includes('thai')) {
    bestCuisine = 'thai';
  } else if (title.includes('mexican') || title.includes('taco') || title.includes('burrito') || title.includes('fajita') || title.includes('enchilada') || title.includes('quesadilla')) {
    bestCuisine = 'mexican';
  } else if (title.includes('italian') || title.includes('balsamic') || title.includes('pesto') || title.includes('spaghetti') || title.includes('lasagna') || title.includes('lasagne') || title.includes('pizza') || title.includes('risotto') || title.includes('bolognese')) {
    bestCuisine = 'italian';
  } else if (title.includes('indian') || title.includes('tikka') || title.includes('masala') || title.includes('tandoori') || (title.includes('curry') && !title.includes('thai'))) {
    bestCuisine = 'indian';
  } else if (title.includes('greek') || title.includes('tzatziki') || title.includes('gyro')) {
    bestCuisine = 'greek';
  } else if (title.includes('chinese') || title.includes('kung pao') || title.includes('chow mein') || title.includes('szechuan') || title.includes('fried rice')) {
    bestCuisine = 'chinese';
  } else if (title.includes('japanese') || title.includes('teriyaki') || title.includes('sushi') || title.includes('ramen') || title.includes('katsu')) {
    bestCuisine = 'japanese';
  } else if (title.includes('french') || title.includes('boulangere') || title.includes('quiche') || title.includes('crepe') || title.includes('crepes')) {
    bestCuisine = 'french';
  } else if (title.includes('spanish') || title.includes('paella') || title.includes('chorizo')) {
    bestCuisine = 'spanish';
  } else if (title.includes('korean') || title.includes('kimchi') || title.includes('bulgogi')) {
    bestCuisine = 'korean';
  } else if (title.includes('mediterranean') || title.includes('falafel') || title.includes('hummus')) {
    bestCuisine = 'mediterranean';
  } else if (title.includes('american') || title.includes('burger') || title.includes('bbq') || title.includes('meatloaf')) {
    bestCuisine = 'american';
  }

  return {
    mealType: bestMealType,
    cuisine: bestCuisine
  };
}

async function main() {
  console.log(`🚀 Recipe Cache Rule-Based Classifier${DRY_RUN ? ' [DRY RUN]' : ''}${FORCE ? ' [FORCE]' : ''}\n`);

  const colSnap = await db.collection('recipe_caches').get();

  if (colSnap.empty) {
    console.log('❌ No documents found in recipe_caches/');
    return;
  }

  console.log(`Found ${colSnap.size} cache chunk(s)\n`);

  let totalRecipes = 0;
  let totalClassified = 0;

  for (const chunkDoc of colSnap.docs) {
    const data = chunkDoc.data();
    const recipes = data.recipes;

    if (!Array.isArray(recipes)) {
      console.log(`⚠️ ${chunkDoc.id}: no "recipes" array, skipping`);
      continue;
    }

    console.log(`Analyzing document: ${chunkDoc.id} (${recipes.length} recipes)`);

    const updated = recipes.map(recipe => {
      const hasLabels = recipe.mealType && recipe.cuisine;
      if (hasLabels && !FORCE) {
        // Skip if already classified and force is not specified
        return recipe;
      }

      const classification = classifyRecipe(recipe);
      totalClassified++;

      return {
        ...recipe,
        mealType: classification.mealType,
        cuisine: classification.cuisine
      };
    });

    totalRecipes += recipes.length;

    if (!DRY_RUN) {
      await chunkDoc.ref.update({ recipes: updated, lastUpdated: new Date() });
      console.log(`✅ Saved classifications to ${chunkDoc.id}\n`);
    } else {
      // Dry run sample preview
      const sample = recipes.map((r, idx) => ({ orig: r, upd: updated[idx] }))
        .filter(x => FORCE || !x.orig.mealType || !x.orig.cuisine)
        .slice(0, 5);

      if (sample.length > 0) {
        console.log('   Preview (Dry Run):');
        sample.forEach(({ upd }) => {
          console.log(`     - "${upd.title}" classified as: [${upd.mealType}] / [${upd.cuisine}]`);
        });
      }
      console.log(`   (dry-run - not saved)\n`);
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Done. ${totalClassified} recipes classified / updated, out of ${totalRecipes} total cached recipes.`);
  if (DRY_RUN) console.log('Dry-run mode: No writes were made to Firestore.');
}

main().catch(err => {
  console.error('Fatal error during classification:', err);
  process.exit(1);
});
