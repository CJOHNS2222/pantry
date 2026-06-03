#!/usr/bin/env node
'use strict';

/**
 * seed-ingredient-images.cjs  (v2 -- CDN-probe strategy)
 *
 * Discovers ingredient images directly from the Spoonacular public CDN
 * WITHOUT using the API or consuming any API points.
 *
 * Strategy:
 *   1. Compute candidate CDN filenames from each item name
 *      (lowercase, spaces => underscores, try .jpg then .png then .jpeg)
 *   2. HEAD-request the CDN to confirm the file exists (no API key needed)
 *   3. Download the image to public/images/items/
 *   4. Regenerate data/item-images.ts
 *
 * Usage:
 *   node scripts/seed-ingredient-images.cjs              # full run
 *   node scripts/seed-ingredient-images.cjs --resume     # skip already done
 *   node scripts/seed-ingredient-images.cjs --cdn-only   # map only, no download
 *   node scripts/seed-ingredient-images.cjs --limit 50   # only first N items
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// MD5 hash of Spoonacular's generic food-cloche placeholder image.
// Any downloaded file matching this hash is rejected as "no real image".
const PLACEHOLDER_MD5 = 'e5e28152a2797ed1c3ffb6e2db37423c';

const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'items');
const TS_OUTPUT = path.join(ROOT, 'data', 'item-images.ts');
const PROGRESS_FILE = path.join(__dirname, '.image-seed-progress.json');

const CDN_SIZE = '500x500';
const CDN_BASE = `https://spoonacular.com/cdn/ingredients_${CDN_SIZE}/`;
const MAX_REDIRECTS = 5;
const DELAY_MS = 80;
const WRITE_INTERVAL = 25;

const args = process.argv.slice(2);
const RESUME = args.includes('--resume');
const CDN_ONLY = args.includes('--cdn-only');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

const ITEMS = [
  // Fruits
  'apple','banana','orange','strawberry','blueberry','raspberry','blackberry',
  'grape','watermelon','pineapple','mango','papaya','kiwi','peach','pear',
  'plum','cherry','apricot','fig','date','pomegranate','lemon','lime',
  'grapefruit','tangerine','coconut','avocado','tomato','olive','cantaloupe',
  'nectarine','clementine','persimmon','guava','passion fruit','dragon fruit',
  'honeydew','blood orange','kumquat','lychee','jackfruit',
  // Vegetables
  'carrot','broccoli','spinach','lettuce','cabbage','cauliflower','celery',
  'cucumber','zucchini','squash','bell pepper','jalapeno','onion','garlic',
  'ginger','potato','sweet potato','corn','peas','green beans','asparagus',
  'artichoke','beet','eggplant','mushroom','kale','arugula','radish',
  'turnip','parsnip','leek','scallion','shallot','fennel','bok choy',
  'brussels sprouts','snow peas','swiss chard','collard greens','okra',
  'butternut squash','acorn squash','rutabaga','kohlrabi','endive',
  'radicchio','watercress','bean sprouts','water chestnut','taro','jicama','chayote',
  // Fresh herbs
  'basil','parsley','cilantro','mint','rosemary','thyme','oregano','dill',
  'sage','chives','tarragon','lemongrass','bay leaf',
  // Dairy & Eggs
  'milk','eggs','butter','cheddar','cream cheese','sour cream','yogurt',
  'heavy cream','cottage cheese','ricotta','mozzarella','parmesan',
  'feta','gouda','brie','swiss cheese','provolone',
  'half and half','almond milk','oat milk','soy milk',
  'evaporated milk','condensed milk','whipping cream','goat cheese',
  'greek yogurt','kefir','buttermilk','ghee',
  'american cheese','pepper jack','gruyere','manchego','havarti',
  'monterey jack','burrata','halloumi','mascarpone','camembert',
  // Meat & Poultry
  'chicken breast','ground beef','steak','pork chop','bacon','sausage',
  'ham','turkey','lamb','duck','pepperoni','salami',
  'chicken thighs','chicken wings','chicken drumsticks','ground turkey',
  'ground pork','beef brisket','short ribs','veal','sirloin steak',
  'pork tenderloin','pork belly','beef liver','chorizo','prosciutto',
  'pancetta','mortadella','pastrami','corned beef','lamb chop',
  'venison','bison','ground lamb',
  // Seafood
  'salmon','tuna','shrimp','cod','tilapia','halibut','crab','lobster',
  'scallops','clams','mussels','oysters','sardines','anchovies',
  'sea bass','trout','mahi mahi','swordfish','catfish','flounder',
  'mackerel','herring','pollock','snapper','squid','octopus','smoked salmon',
  // Bread & Baked Goods
  'bread','sourdough','bagel','english muffin',
  'tortilla','pita bread','croissant','dinner rolls','baguette',
  'naan','focaccia','ciabatta','pretzel','rye bread',
  'pumpernickel','cornbread','muffin','biscuit',
  'scone','waffle','pancake','brioche',
  // Grains & Pasta
  'white rice','brown rice','jasmine rice','basmati rice','arborio rice','wild rice',
  'spaghetti','penne','fettuccine','lasagna noodles','rigatoni',
  'bow tie pasta','shell pasta','orzo','angel hair pasta','linguine',
  'ramen noodles','udon noodles','rice noodles','soba noodles','vermicelli',
  'egg noodles','gnocchi',
  'quinoa','oatmeal','granola','cereal','grits','couscous','barley',
  'cornmeal','polenta','bulgur','farro','millet','buckwheat',
  'breadcrumbs','panko',
  // Legumes
  'black beans','kidney beans','chickpeas','lentils','pinto beans',
  'white beans','edamame','split peas','lima beans','navy beans',
  'cannellini beans','black eyed peas','mung beans','fava beans',
  // Nuts & Seeds
  'almonds','peanuts','walnuts','cashews','pecans','pistachios',
  'sunflower seeds','pumpkin seeds','chia seeds','flax seeds','sesame seeds',
  'peanut butter','almond butter','tahini','macadamia nuts','brazil nuts',
  'pine nuts','hemp seeds','poppy seeds','coconut flakes','hazelnuts',
  // Condiments & Sauces
  'ketchup','mustard','mayonnaise','hot sauce','soy sauce','worcestershire sauce',
  'barbecue sauce','ranch dressing','honey mustard','sriracha','teriyaki sauce',
  'hoisin sauce','fish sauce','oyster sauce','marinara sauce','salsa',
  'guacamole','hummus','pesto','alfredo sauce',
  'buffalo sauce','sweet chili sauce','caesar dressing','balsamic vinegar',
  'apple cider vinegar','red wine vinegar','white wine vinegar','rice vinegar',
  'dijon mustard','whole grain mustard','horseradish','capers','miso paste',
  'gochujang','harissa','sambal',
  // Oils
  'olive oil','vegetable oil','coconut oil','sesame oil','avocado oil',
  'canola oil','sunflower oil','peanut oil',
  // Canned & Jarred
  'canned tomatoes','tomato paste','tomato sauce','canned corn',
  'chicken broth','beef broth','vegetable broth','coconut milk','canned pumpkin',
  'applesauce','canned pineapple','pickles','relish','tomato soup',
  'cream of mushroom soup','cream of chicken soup','chicken noodle soup',
  // Spices & Seasonings
  'salt','black pepper','garlic powder','onion powder','paprika',
  'cumin','coriander','cinnamon','nutmeg','cloves','allspice',
  'chili powder','cayenne pepper','turmeric','cardamom','ginger powder',
  'lemon pepper','curry powder','five spice','star anise',
  'fennel seeds','mustard seeds','red pepper flakes','smoked paprika',
  'white pepper','celery salt','vanilla extract','almond extract','saffron',
  // Baking & Sweeteners
  'flour','sugar','brown sugar','powdered sugar','baking soda','baking powder',
  'yeast','cornstarch','cocoa powder','chocolate chips','honey',
  'maple syrup','molasses','agave nectar','corn syrup',
  'cream of tartar','gelatin','cake flour','bread flour',
  'whole wheat flour','almond flour','coconut flour',
  'shortening','dark chocolate','white chocolate',
  // Beverages
  'coffee','black tea','orange juice','apple juice','cranberry juice',
  'lemonade','sparkling water','coconut water','matcha powder','protein powder',
  // Frozen Foods
  'frozen peas','frozen corn','frozen broccoli','frozen spinach',
  'frozen berries','frozen mango','ice cream','frozen pizza',
  'frozen french fries','frozen waffles','frozen edamame','gelato',
  // Snacks
  'potato chips','tortilla chips','crackers','popcorn','pretzels',
  'trail mix','granola bar','protein bar','rice cakes','beef jerky',
  'gummy bears','graham crackers','pork rinds',
  'raisins','dried cranberries','dried apricot','prunes',
  // Breakfast extras
  'jam','jelly','orange marmalade','nutella',
  // Plant-Based
  'tofu','tempeh','seitan','nutritional yeast','kimchi','sauerkraut',
  // Other
  'phyllo dough','puff pastry','pie crust','pizza dough',
];

const UNIQUE_ITEMS = [...new Set(ITEMS)].slice(0, LIMIT);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getCandidateFilenames(itemName) {
  const base = itemName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g,'');
  return [`${base}.jpg`,`${base}.png`,`${base}.jpeg`];
}

function headRequest(rawUrl, redirectCount = 0) {
  return new Promise(resolve => {
    if (redirectCount > MAX_REDIRECTS) return resolve(-1);
    try {
      const parsed = new URL(rawUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(rawUrl, { method:'HEAD', headers:{'User-Agent':'StockAndSpoon/2.0'} }, res => {
        res.resume();
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
          return resolve(headRequest(loc, redirectCount + 1));
        }
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(-1));
      req.setTimeout(8000, () => { req.destroy(); resolve(-1); });
      req.end();
    } catch { resolve(-1); }
  });
}

function httpGet(rawUrl, redirectCount = 0) {
  return new Promise(resolve => {
    if (redirectCount > MAX_REDIRECTS) return resolve(null);
    try {
      const parsed = new URL(rawUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      lib.get(rawUrl, { headers:{'User-Agent':'StockAndSpoon/2.0'} }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const loc = res.headers.location.startsWith('http') ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
          return resolve(httpGet(loc, redirectCount + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    } catch { resolve(null); }
  });
}

async function probeCdn(itemName) {
  for (const filename of getCandidateFilenames(itemName)) {
    const status = await headRequest(`${CDN_BASE}${filename}`);
    if (status === 200) return filename;
    await sleep(30);
  }
  return null;
}

function isPlaceholder(buf) {
  if (!buf) return true;
  const hash = crypto.createHash('md5').update(buf).digest('hex');
  return hash === PLACEHOLDER_MD5;
}

async function downloadImage(filename, destPath) {
  const buf = await httpGet(`${CDN_BASE}${filename}`);
  if (!buf || buf.length < 500 || isPlaceholder(buf)) return false;
  fs.writeFileSync(destPath, buf);
  return true;
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE))
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {}
  return { completed:[], mapping:{} };
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }

function writeOutputTs(mapping) {
  const entries = Object.entries(mapping)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const content = `/**
 * AUTO-GENERATED by scripts/seed-ingredient-images.cjs
 * DO NOT EDIT MANUALLY -- run \`npm run seed:images\` to regenerate.
 *
 * Maps normalized item names => Spoonacular ingredient image filenames.
 *
 * Resolution order in getItemImage():
 *   1. Manual curated mappings (existing PNGs in /images/)
 *   2. This map => /images/items/{filename}  (locally downloaded, offline-first)
 *   3. Spoonacular CDN URL fallback via onError handler
 *   4. Category fallback
 *   5. /images/placeholder.svg  (triggers async fetchExternalItemImage)
 *
 * To rebuild: npm run seed:images
 * Generated: ${new Date().toISOString()}
 * Items: ${Object.keys(mapping).length}
 */
export const itemImages: Record<string, string> = {
${entries}
};

/** CDN base URL for fallback when local image is unavailable (fresh clone etc.) */
export const ITEM_IMAGE_CDN_BASE = 'https://spoonacular.com/cdn/ingredients_${CDN_SIZE}/';
`;
  fs.writeFileSync(TS_OUTPUT, content);
}

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive:true });
  fs.mkdirSync(path.dirname(TS_OUTPUT), { recursive:true });

  const progress = RESUME ? loadProgress() : { completed:[], mapping:{} };
  const completedSet = new Set(progress.completed);
  const toProcess = UNIQUE_ITEMS.filter(item => !completedSet.has(item.toLowerCase().trim()));
  const total = UNIQUE_ITEMS.length;

  console.log(`\n  Ingredient Image Seeder  (CDN-probe, no API key needed)`);
  console.log(`   Total items:      ${total}`);
  console.log(`   Already done:     ${completedSet.size}`);
  console.log(`   To process:       ${toProcess.length}`);
  console.log(`   Download images:  ${CDN_ONLY ? 'no (--cdn-only)' : 'yes'}`);
  console.log(`   CDN size:         ${CDN_SIZE}\n`);

  let found = 0, notFound = 0, downloaded = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const key = item.toLowerCase().trim();
    const pct = Math.round(((completedSet.size + i + 1) / total) * 100);
    process.stdout.write(`[${String(pct).padStart(3)}%] ${item.padEnd(32)}`);

    const filename = await probeCdn(item);
    if (!filename) {
      process.stdout.write(`-  (not on CDN)\n`);
      notFound++;
    } else {
      found++;
      progress.mapping[key] = filename;

      if (!CDN_ONLY) {
        const ext = path.extname(filename);
        const safeName = key.replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_');
        const localFilename = `${safeName}${ext}`;
        const destPath = path.join(IMAGES_DIR, localFilename);
        const needsDownload = !fs.existsSync(destPath) || fs.statSync(destPath).size < 500;
        if (needsDownload) {
          const ok = await downloadImage(filename, destPath);
          if (ok) { progress.mapping[key] = localFilename; downloaded++; }
          process.stdout.write(`ok  ${localFilename}\n`);
        } else {
          progress.mapping[key] = localFilename;
          downloaded++;
          process.stdout.write(`ok  ${localFilename} (cached)\n`);
        }
      } else {
        process.stdout.write(`->  ${filename}\n`);
      }
    }

    progress.completed.push(key);
    saveProgress(progress);
    if ((i + 1) % WRITE_INTERVAL === 0) writeOutputTs(progress.mapping);
    await sleep(DELAY_MS);
  }

  writeOutputTs(progress.mapping);

  console.log(`\nDone!`);
  console.log(`   CDN found:    ${found + completedSet.size - notFound}`);
  console.log(`   Not on CDN:   ${notFound}`);
  console.log(`   Downloaded:   ${downloaded} images`);
  console.log(`   Total mapped: ${Object.keys(progress.mapping).length}`);
  console.log(`   TS file:  ${TS_OUTPUT}`);
  console.log(`   Images:   ${IMAGES_DIR}\n`);

  if (!RESUME && LIMIT === Infinity && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });