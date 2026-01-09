import { fetchGroceryItemImage } from '../services/imageService.js';

// Test the image fetching for some common grocery items
const testItems = [
  'milk',
  'bread',
  'eggs',
  'chicken',
  'apples',
  'carrots',
  'pasta',
  'cheese'
];

async function testImageFetching() {
  console.log('Testing grocery item image fetching...\n');

  for (const item of testItems) {
    try {
      console.log(`Fetching image for: ${item}`);
      const imageUrl = await fetchGroceryItemImage(item);
      if (imageUrl) {
        console.log(`✓ Found image: ${imageUrl}\n`);
      } else {
        console.log(`✗ No image found for ${item}\n`);
      }
    } catch (error) {
      console.error(`Error fetching image for ${item}:`, error);
    }
  }
}

testImageFetching();