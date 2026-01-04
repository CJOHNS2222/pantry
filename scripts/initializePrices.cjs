import { groceryPriceService } from './services/groceryPriceService';

// Initialize some sample price data for common ingredients
// This would typically be run once to seed the database
export const initializeSamplePrices = async () => {
  const samplePrices = [
    // Proteins
    { ingredient: 'chicken', price: 3.99, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'beef', price: 5.99, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'eggs', price: 0.25, unit: 'each', store: 'Average Grocery Store' },
    { ingredient: 'milk', price: 3.99, unit: 'gallon', store: 'Average Grocery Store' },
    { ingredient: 'cheese', price: 4.99, unit: 'lb', store: 'Average Grocery Store' },

    // Produce
    { ingredient: 'onion', price: 1.29, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'tomato', price: 2.49, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'lettuce', price: 1.99, unit: 'head', store: 'Average Grocery Store' },
    { ingredient: 'carrot', price: 1.49, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'apple', price: 2.49, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'banana', price: 0.79, unit: 'lb', store: 'Average Grocery Store' },

    // Pantry staples
    { ingredient: 'flour', price: 3.49, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'rice', price: 2.99, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'pasta', price: 1.49, unit: 'lb', store: 'Average Grocery Store' },
    { ingredient: 'bread', price: 3.49, unit: 'loaf', store: 'Average Grocery Store' },
    { ingredient: 'butter', price: 4.99, unit: 'lb', store: 'Average Grocery Store' },
  ];

  try {
    console.log('Initializing sample grocery prices...');

    for (const priceData of samplePrices) {
      await groceryPriceService.submitPriceUpdate(
        priceData.ingredient,
        priceData.price,
        priceData.unit,
        'system_initializer',
        priceData.store
      );
    }

    console.log('Sample prices initialized successfully!');
  } catch (error) {
    console.error('Error initializing sample prices:', error);
  }
};