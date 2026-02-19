
const admin = require('firebase-admin');

// IMPORTANT: Make sure the path to your service account key is correct.
// This path is relative to the project root where you run the 'node' command.
const serviceAccount = require('./key/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const [userId] = process.argv.slice(2);

if (!userId) {
  console.error('Error: A test user ID must be provided.');
  console.log('Usage: node scripts/load-test-meal-plan.js <USER_ID>');
  process.exit(1);
}

const MEALS_TO_ADD = 50;
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function getRandomDate() {
  const today = new Date();
  const randomDay = Math.floor(Math.random() * 14); // 0-13 days from now
  const date = new Date(today);
  date.setDate(today.getDate() + randomDay);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getRandomMealType() {
  return MEAL_TYPES[Math.floor(Math.random() * MEAL_TYPES.length)];
}

function createDummyRecipe(index) {
  return {
    id: `test-recipe-${index}-${Date.now()}`,
    title: `Test Recipe ${index}`,
    servings: Math.floor(Math.random() * 4) + 1,
    readyInMinutes: Math.floor(Math.random() * 60) + 15,
    image: 'public/images/baked_salmon.png',
    ingredients: ['1 salmon fillet', '1 tbsp olive oil', 'salt and pepper'],
    instructions: ['Preheat oven', 'Season salmon', 'Bake until cooked through'],
  };
}

async function runLoadTest() {
  console.log(`Starting meal plan load test for user: ${userId}`);
  console.log(`Attempting to add ${MEALS_TO_ADD} meals...`);

  // Ensure the user has a mealPlan cache document
  const cacheRef = db.doc(`users/${userId}/cache/mealPlan`);
  const cacheSnap = await cacheRef.get();

  if (!cacheSnap.exists) {
      console.log('Meal plan cache does not exist for user. Creating it...');
      await cacheRef.set({ version: '1.0', days: {} });
  }

  const promises = [];

  for (let i = 0; i < MEALS_TO_ADD; i++) {
    const date = getRandomDate();
    const mealType = getRandomMealType();
    const recipe = createDummyRecipe(i);
    const newMeal = {
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipe: recipe,
      mealType: mealType
    };

    // Use FieldValue.arrayUnion for an atomic, idempotent update
    const promise = cacheRef.update({
      [`days.${date}.${mealType}`]: admin.firestore.FieldValue.arrayUnion(newMeal)
    });
    promises.push(promise);
  }

  try {
    await Promise.all(promises);
    console.log(`Successfully added ${MEALS_TO_ADD} meals to the meal plan.`);
    console.log('Test finished. Please check your monitoring dashboard for write activity.');
  } catch (error) {
    console.error('An error occurred during the load test:', error);
    console.error('This could be due to an incorrect user ID, Firestore rules, or an issue with your service account key.');
  }
}

runLoadTest();
