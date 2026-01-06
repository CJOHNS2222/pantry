const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBqF8bfPIAhLS3eaN_MArjxdlB1DqE0QWY",
  authDomain: "gen-lang-client-0893655267.firebaseapp.com",
  projectId: "gen-lang-client-0893655267",
  storageBucket: "gen-lang-client-0893655267.appspot.com",
  messagingSenderId: "651327126572",
  appId: "1:651327126572:android:df9a284cff89eedaff6589"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addTestData() {
  try {
    // Add test inventory item
    await setDoc(doc(db, 'users', 'testUserId', 'inventory', 'testItem'), {
      item: 'Test Apple',
      category: 'Fruit',
      quantity: 5,
      unit: 'pieces'
    });

    // Add test shopping list item
    await addDoc(collection(db, 'users', 'testUserId', 'shoppingList'), {
      item: 'Test Milk',
      category: 'Dairy',
      checked: false
    });

    // Add test rating
    await addDoc(collection(db, 'ratings'), {
      recipeTitle: 'Test Recipe',
      rating: 5,
      comment: 'Great recipe!',
      userName: 'Test User',
      date: new Date(),
      userId: 'testUserId'
    });

    console.log('Test data added successfully!');
  } catch (error) {
    console.error('Error adding test data:', error);
  }
}

addTestData();