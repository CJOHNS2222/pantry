import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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

async function debugClassification() {
  const docRef = db.doc('recipe_caches/popular_recipes');
  const docSnap = await docRef.get();
  const recipes = docSnap.data().recipes || [];
  
  recipes.slice(0, 5).forEach((recipe) => {
    const title = (recipe.title || '').toLowerCase();
    const desc = (recipe.description || '').toLowerCase();
    const ingredients = Array.isArray(recipe.ingredients) 
      ? recipe.ingredients.map(i => i.toLowerCase()).join(' ') 
      : '';
    const searchText = `${title} ${desc} ${ingredients}`;
    
    console.log(`\n========================================`);
    console.log(`Recipe: "${recipe.title}"`);
    console.log(`----------------------------------------`);
    
    console.log(`Meal Type Score breakdown:`);
    MEAL_TYPE_RULES.forEach(rule => {
      const matches = [];
      rule.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const m = searchText.match(regex);
        if (m) matches.push(`${keyword} (${m.length}x)`);
      });
      console.log(`   - ${rule.type.padEnd(10)}: score = ${matches.length}. Matches: [${matches.join(', ')}]`);
    });

    console.log(`Cuisine Score breakdown:`);
    CUISINE_RULES.forEach(rule => {
      const matches = [];
      rule.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const m = searchText.match(regex);
        if (m) matches.push(`${keyword} (${m.length}x)`);
      });
      console.log(`   - ${rule.cuisine.padEnd(15)}: score = ${matches.length}. Matches: [${matches.join(', ')}]`);
    });
  });
}

debugClassification().catch(console.error);
