import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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

async function checkSamples() {
  const docRef = db.doc('recipe_caches/popular_recipes');
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    console.log('❌ Documents do not exist in recipe_caches/popular_recipes');
    return;
  }
  
  const recipes = docSnap.data().recipes || [];
  console.log(`\n--- Samples from recipe_caches/popular_recipes (${recipes.length} total) ---`);
  
  // Print a selection of recipes with their title, mealType, and cuisine
  recipes.slice(0, 10).forEach((recipe, idx) => {
    console.log(`${idx + 1}. "${recipe.title}"`);
    console.log(`   - Meal Type: ${recipe.mealType || 'UNCLASSIFIED'}`);
    console.log(`   - Cuisine:   ${recipe.cuisine || 'UNCLASSIFIED'}`);
    console.log(`   - Ingredients: ${recipe.ingredients?.slice(0, 3).join(', ') || 'None'}...`);
  });
}

checkSamples().catch(err => {
  console.error(err);
});
