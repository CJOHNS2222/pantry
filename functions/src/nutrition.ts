import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';

// Ensure the Admin SDK is initialized
if (!admin.apps?.length) {
  admin.initializeApp();
}

/**
 * Firebase Function to proxy USDA FoodData Central API calls
 * Solves CORS issues when calling from browser
 */
export const getNutritionData = onCall(async (request) => {
  try {
    const { query, pageSize = 5, fdcId } = request.data;

    // If fdcId is provided, fetch detailed nutrition information
    if (fdcId) {
      if (typeof fdcId !== 'number') {
        throw new HttpsError('invalid-argument', 'fdcId must be a number');
      }

      const detailUrl = `https://fdc.nal.usda.gov/api/foods/${fdcId}`;

      console.log('Fetching detailed nutrition data from USDA API:', detailUrl);

      const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        }
      });

      if (!response.ok) {
        console.error('USDA API detail error:', response.status, response.statusText);
        throw new HttpsError('unavailable', `USDA API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Log successful response
      console.log(`Successfully fetched detailed nutrition data for FDC ID: ${fdcId}`);

      return data;
    }

    // Otherwise, perform search
    if (!query || typeof query !== 'string') {
      throw new HttpsError('invalid-argument', 'Query parameter is required and must be a string');
    }

    if (query.length < 2) {
      throw new HttpsError('invalid-argument', 'Query must be at least 2 characters long');
    }

    const apiUrl = `https://fdc.nal.usda.gov/api/foods/search?query=${encodeURIComponent(query)}&pageSize=${Math.min(pageSize, 10)}`;

    console.log('Fetching nutrition data from USDA API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartPantry/1.0'
      }
    });

    if (!response.ok) {
      console.error('USDA API error:', response.status, response.statusText);
      throw new HttpsError('unavailable', `USDA API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Log successful response
    console.log(`Successfully fetched ${data.foods?.length || 0} nutrition results for query: "${query}"`);

    return data;

  } catch (error) {
    console.error('Error in getNutritionData function:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch nutrition data');
  }
});