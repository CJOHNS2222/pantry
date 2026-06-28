import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raw items and prices from screenshots
const items = [
  // Produce
  { name: 'bananas', price: 0.66, unit: '1 lb' },
  { name: 'gala apples', price: 1.99, unit: '1 lb' },
  { name: 'strawberries', price: 2.65, unit: '16 oz clamshell' },
  { name: 'navel oranges', price: 1.60, unit: '1 lb' },
  { name: 'red grapes', price: 2.85, unit: '1 lb' },
  { name: 'lemons', price: 0.65, unit: 'each' },
  { name: 'limes', price: 0.45, unit: 'each' },
  { name: 'hass avocados', price: 1.25, unit: 'each' },
  { name: 'blueberries', price: 3.49, unit: '6 oz pint' },
  { name: 'russet potatoes', price: 0.85, unit: '1 lb' },
  { name: 'yellow onions', price: 0.99, unit: '1 lb' },
  { name: 'roma tomatoes', price: 1.90, unit: '1 lb' },
  { name: 'iceberg lettuce', price: 1.89, unit: 'head' },
  { name: 'broccoli crowns', price: 1.95, unit: '1 lb' },
  { name: 'whole carrots', price: 1.15, unit: '1 lb bag' },
  { name: 'celery', price: 1.75, unit: 'bunch' },
  { name: 'garlic', price: 0.75, unit: 'bulb' },
  { name: 'green bell peppers', price: 0.89, unit: 'each' },
  { name: 'red bell peppers', price: 1.49, unit: 'each' },
  { name: 'cucumbers', price: 0.79, unit: 'each' },
  { name: 'zucchini', price: 1.65, unit: '1 lb' },
  { name: 'fresh spinach', price: 2.99, unit: '8 oz bag' },
  { name: 'asparagus', price: 3.49, unit: '1 lb bunch' },
  { name: 'sweet potatoes', price: 1.10, unit: '1 lb' },
  { name: 'white mushrooms', price: 2.29, unit: '8 oz whole' },

  // Poultry & Seafood
  { name: 'ground beef (80/20)', price: 6.80, unit: '1 lb' },
  { name: 'chicken breasts (boneless/skinless)', price: 4.17, unit: '1 lb' },
  { name: 'chicken thighs (bone-in)', price: 2.49, unit: '1 lb' },
  { name: 'whole chicken', price: 1.89, unit: '1 lb' },
  { name: 'pork chops (bone-in)', price: 4.15, unit: '1 lb' },
  { name: 'pork bacon', price: 6.49, unit: '16 oz pack' },
  { name: 'ribeye steak', price: 14.99, unit: '1 lb' },
  { name: 'atlantic salmon fillet', price: 11.99, unit: '1 lb' },
  { name: 'raw shrimp (frozen, peeled)', price: 8.99, unit: '1 lb' },
  { name: 'canned tuna (in water)', price: 1.35, unit: '5 oz can' },
  { name: 'deli turkey slices', price: 8.99, unit: '1 lb' },
  { name: 'deli ham slices', price: 7.99, unit: '1 lb' },
  { name: 'italian sausage links', price: 5.49, unit: '19 oz pack' },
  { name: 'rotisserie chicken', price: 7.99, unit: 'whole (cooked)' },
  { name: 'ground turkey', price: 4.59, unit: '1 lb' },

  // Dairy & Eggs
  { name: 'whole milk', price: 4.07, unit: '1 gallon' },
  { name: '2% milk', price: 3.96, unit: '1 gallon' },
  { name: 'large white eggs', price: 2.45, unit: '1 dozen' },
  { name: 'unsalted butter', price: 4.49, unit: '16 oz (4 sticks)' },
  { name: 'cheddar cheese', price: 2.75, unit: '8 oz block' },
  { name: 'shredded mozzarella', price: 2.69, unit: '8 oz bag' },
  { name: 'cream cheese', price: 2.59, unit: '8 oz block' },
  { name: 'sour cream', price: 2.39, unit: '16 oz tub' },
  { name: 'plain greek yogurt', price: 4.89, unit: '32 oz tub' },
  { name: 'single-serve fruit yogurt', price: 0.85, unit: '6 oz cup' },
  { name: 'cottage cheese', price: 2.99, unit: '16 oz tub' },
  { name: 'heavy whipping cream', price: 3.29, unit: '16 oz carton' },
  { name: 'almond milk (unsweetened)', price: 3.49, unit: '64 oz carton' },

  // Bakery & Bread
  { name: 'white bread', price: 1.85, unit: '20 oz loaf' },
  { name: 'whole wheat bread', price: 2.69, unit: '20 oz loaf' },
  { name: 'hamburger buns', price: 2.53, unit: '8 count pack' },
  { name: 'hot dog buns', price: 2.39, unit: '8 count pack' },
  { name: 'flour tortillas', price: 2.49, unit: '10 count pack' },
  { name: 'plain bagels', price: 4.29, unit: '6 count pack' },
  { name: 'english muffins', price: 2.99, unit: '6 count pack' },
  { name: 'chocolate chip cookies', price: 4.25, unit: '13 oz package' },
  { name: 'dinner rolls', price: 3.29, unit: '12 count pack' },

  // Pantry Staples & Dry Goods
  { name: 'all-purpose flour', price: 3.89, unit: '5 lb bag' },
  { name: 'granulated white sugar', price: 3.69, unit: '4 lb bag' },
  { name: 'long-grain white rice', price: 1.06, unit: '1 lb bag' },
  { name: 'spaghetti pasta', price: 1.32, unit: '16 oz box' },
  { name: 'olive oil (extra virgin)', price: 8.49, unit: '16.9 oz bottle' },
  { name: 'vegetable oil', price: 4.39, unit: '48 oz bottle' },
  { name: 'creamy peanut butter', price: 2.89, unit: '16 oz jar' },
  { name: 'strawberry jam', price: 3.29, unit: '18 oz jar' },
  { name: 'canned tomato sauce', price: 0.65, unit: '8 oz can' },
  { name: 'canned diced tomatoes', price: 1.25, unit: '14.5 oz can' },
  { name: 'canned black beans', price: 0.99, unit: '15 oz can' },
  { name: 'canned sweet corn', price: 1.10, unit: '15.25 oz can' },
  { name: 'pork and beans', price: 3.06, unit: '32 oz can' },
  { name: 'mayonnaise', price: 4.99, unit: '30 oz jar' },
  { name: 'tomato ketchup', price: 2.79, unit: '20 oz bottle' },
  { name: 'yellow mustard', price: 1.89, unit: '14 oz bottle' },
  { name: 'table salt', price: 1.19, unit: '26 oz canister' },
  { name: 'ground black pepper', price: 3.89, unit: '3 oz tin' },
  { name: 'rolled oats', price: 2.99, unit: '18 oz canister' },
  { name: 'clover honey', price: 4.49, unit: '12 oz squeeze bear' },
  { name: 'pure maple syrup', price: 5.99, unit: '8 oz bottle' },

  // Snacks & Cereals
  { name: 'potato chips', price: 4.76, unit: '16 oz bag' },
  { name: 'tortilla chips', price: 3.99, unit: '13 oz bag' },
  { name: 'saltine crackers', price: 2.79, unit: '16 oz box' },
  { name: 'toasted oats cereal', price: 4.39, unit: '12 oz box' },
  { name: 'chewy granola bars', price: 3.19, unit: '6 count box' },
  { name: 'microwave popcorn', price: 2.49, unit: '3 pack box' },
  { name: 'twisted pretzels', price: 3.29, unit: '16 oz bag' },

  // Beverages
  { name: 'ground roast coffee', price: 9.50, unit: '12 oz bag' },
  { name: 'black tea bags', price: 3.89, unit: '100 count box' },
  { name: '100% orange juice', price: 4.69, unit: '52 oz carton' },
  { name: 'apple juice', price: 3.29, unit: '64 oz bottle' },
  { name: 'cola soda', price: 7.99, unit: '12 pack (12 oz cans)' },
  { name: 'purified bottled water', price: 4.49, unit: '24 pack (16.9 oz)' },

  // Frozen Foods
  { name: 'frozen pepperoni pizza', price: 6.99, unit: '25 oz box' },
  { name: 'vanilla ice cream', price: 5.99, unit: '48 oz (0.5 gallon)' },
  { name: 'frozen mixed vegetables', price: 1.49, unit: '12 oz bag' },
  { name: 'frozen french fries', price: 3.69, unit: '32 oz bag' }
];

async function main() {
  console.log('🛒 Seeding Price Cache in Firestore...');
  
  // Load service account key
  const serviceAccountPath = path.join(__dirname, 'ornate-compass-478504-e1-firebase-adminsdk-fbsvc-b421e3c5e1.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  // Initialize Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const docRef = db.doc('price_cache/priceData');

  // Convert the items array into the PriceDataCache map format
  const priceDataMap = {};
  const now = new Date();

  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    priceDataMap[key] = {
      averagePrice: item.price,
      minPrice: Number((item.price * 0.85).toFixed(2)),
      maxPrice: Number((item.price * 1.15).toFixed(2)),
      sampleSize: 10,
      lastUpdated: now,
      unit: item.unit
    };
  }

  try {
    // Get existing data if any to merge
    const docSnap = await docRef.get();
    let mergedData = { ...priceDataMap };
    
    if (docSnap.exists) {
      const existingData = docSnap.data();
      console.log(`Found ${Object.keys(existingData).length} existing price cache entries.`);
      mergedData = {
        ...existingData,
        ...priceDataMap
      };
    }

    // Write to Firestore
    await docRef.set(mergedData);
    console.log(`✅ Successfully seeded ${Object.keys(mergedData).length} price cache entries in Firestore!`);
  } catch (error) {
    console.error('❌ Failed to update price cache:', error);
  }
}

main().catch(console.error);
