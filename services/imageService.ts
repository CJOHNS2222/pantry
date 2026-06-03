export async function fetchRecipeImage(recipeTitle: string): Promise<string | null> {
  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_CSE_API_KEY;
  const cseId = (import.meta as any)?.env?.VITE_GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return null;
  const query = encodeURIComponent(recipeTitle);
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${query}&searchType=image&num=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.items?.[0]?.link || null;
  } catch {
    return null;
  }
}

export async function fetchGroceryItemImage(itemName: string): Promise<string | null> {
  try {
    // Check cache first
    const { getCachedImageUrl } = await import('./imageCacheService');
    const cachedUrl = await getCachedImageUrl(itemName);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Clean the item name for better search results
    const cleanName = itemName.toLowerCase()
      .replace(/^\d+\s+/, '') // Remove leading quantities
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '') // Remove size descriptors
      .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '') // Remove prep descriptors
      .trim();

    // Search Open Food Facts API with timeout (v2 endpoint supports CORS)
    const searchUrl = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(cleanName)}&fields=product_name,image_url&page_size=10`;
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
    });
    
    try {
      const response = await Promise.race([
        fetch(searchUrl),
        timeoutPromise
      ]) as Response;
      
      // Handle CORS or other fetch errors gracefully
      if (!response.ok) {
        if (response.status === 0 || response.type === 'opaque') {
          // CORS error or network error - skip to fallback
          console.log(`Open Food Facts API blocked (CORS), trying fallback for: ${cleanName}`);
        } else {
          throw new Error(`Open Food Facts API error: ${response.status}`);
        }
      } else {
        const data = await response.json();

        if (data.products && data.products.length > 0) {
          // Find the first product with an image_url
          for (const product of data.products) {
            if (product.image_url && product.product_name) {
              // Check if the product name is reasonably similar to our search
              const productName = product.product_name.toLowerCase();
              const searchWords = cleanName.split(' ');
              const matchCount = searchWords.filter(word =>
                productName.includes(word) || cleanName.includes(productName)
              ).length;

              if (matchCount > 0 || productName.includes(cleanName) || cleanName.includes(productName)) {
                // Cache the image for future use
                const { cacheImageFromUrl } = await import('./imageCacheService');
                const cachedUrl = await cacheImageFromUrl(product.image_url, itemName);
                return cachedUrl || product.image_url;
              }
            }
          }
        }
      }
    } catch (fetchError: any) {
      if (fetchError.message === 'Request timeout') {
        console.log(`Open Food Facts API timeout, trying fallback for: ${cleanName}`);
      } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('CORS')) {
        console.log(`Open Food Facts API blocked (CORS), trying fallback for: ${cleanName}`);
      } else {
        console.log(`Open Food Facts API error (${fetchError.message}), trying fallback for: ${cleanName}`);
      }
    }

    // Fallback to Unsplash if Open Food Facts doesn't have a good match
    const unsplashUrl = await fetchUnsplashImage(cleanName);
    if (unsplashUrl) {
      // Cache the Unsplash image too
      const { cacheImageFromUrl } = await import('./imageCacheService');
      const cachedUrl = await cacheImageFromUrl(unsplashUrl, itemName);
      return cachedUrl || unsplashUrl;
    }

    return null;
  } catch (err: any) {
    console.error('Error fetching grocery item image:', err);
    return null;
  }
}

// Re-export upload helper for general item image uploads
export { uploadItemImage } from './leftoverImageService';

async function fetchUnsplashImage(query: string): Promise<string | null> {
  const accessKey = (import.meta as any)?.env?.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.log('No Unsplash API key provided, skipping Unsplash search');
    return null;
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' food')}&per_page=1&orientation=landscape`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`
      }
    });
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const imageUrl = data.results[0].urls.regular;
      // Cache the Unsplash image
      const { cacheImageFromUrl } = await import('./imageCacheService');
      const cachedUrl = await cacheImageFromUrl(imageUrl, query);
      return cachedUrl || imageUrl;
    }
  } catch (err: any) {
    console.error('Error fetching from Unsplash:', err);
  }

  return null;
}
