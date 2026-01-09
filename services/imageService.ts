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
    // Clean the item name for better search results
    const cleanName = itemName.toLowerCase()
      .replace(/^\d+\s+/, '') // Remove leading quantities
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '') // Remove size descriptors
      .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '') // Remove prep descriptors
      .trim();

    // Search Open Food Facts API
    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(cleanName)}&json=1&fields=product_name,image_url&page_size=10`;
    const response = await fetch(searchUrl);
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
            return product.image_url;
          }
        }
      }
    }

    // Fallback to Unsplash if Open Food Facts doesn't have a good match
    return await fetchUnsplashImage(cleanName);
  } catch (error) {
    console.error('Error fetching grocery item image:', error);
    return null;
  }
}

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
      return data.results[0].urls.regular;
    }
  } catch (error) {
    console.error('Error fetching from Unsplash:', error);
  }

  return null;
}
