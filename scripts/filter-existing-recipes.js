import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env.local');

let envVars = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
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
  // ignore
}

const serviceAccountPath = join(projectRoot, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: envVars.VITE_PROJECT_ID || process.env.VITE_PROJECT_ID
});

const db = getFirestore(app);

const inputPath = join(projectRoot, 'scripts', 'test-data', 'recipes_to_enrich.json');
const outputPath = join(projectRoot, 'scripts', 'test-data', 'recipes_to_enrich_filtered.json');

async function main() {
  const recipes = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const filtered = [];
  
  console.log(`Checking database for ${recipes.length} recipes...`);
  
  for (const recipe of recipes) {
    const existing = await db.collection('recipes').where('title', '==', recipe.title).get();
    if (existing.empty) {
      filtered.push(recipe);
    } else {
      console.log(`- Exists: "${recipe.title}"`);
    }
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));
  console.log(`Filtered down to ${filtered.length} recipes to enrich. Saved to ${outputPath}`);
  process.exit(0);
}

main().catch(console.error);
