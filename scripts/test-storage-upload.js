import { uploadRecipeImage } from '../services/recipeService.js';

async function testImageUpload() {
  console.log('🧪 Testing Firebase Storage image upload...');

  try {
    // Test with a sample Spoonacular image URL
    const testImageUrl = 'https://spoonacular.com/recipeImages/716429-312x231.jpg';
    const testRecipeId = 'test-recipe-123';

    console.log('📤 Uploading test image...');
    const uploadedUrl = await uploadRecipeImage(testImageUrl, testRecipeId);

    console.log('✅ Image upload successful!');
    console.log('📍 Uploaded URL:', uploadedUrl);

    // Check if it's a Firebase Storage URL (not the original)
    if (uploadedUrl.includes('firebasestorage.googleapis.com')) {
      console.log('🎉 Firebase Storage upload working correctly!');
    } else {
      console.log('⚠️  Upload returned original URL (fallback worked)');
    }

  } catch (error) {
    console.error('❌ Image upload failed:', error.message);
  }
}

testImageUpload();