import { ShoppingItem } from '../types';

// Top ~30 most common shopping list staples mapped to standard Walmart Item IDs (UPCs / Catalog IDs)
export const STAPLE_WALMART_MAP: Record<string, string> = {
  // Proteins
  'chicken breast': '51259021',
  'chicken': '51259021',
  'ground beef': '51259005',
  'beef': '51259005',
  'steak': '51259005',
  'pork': '10448679',
  'salmon': '172844781',
  'fish': '172844781',
  'bacon': '10315998',
  'turkey': '9.50',
  'eggs': '172844358',

  // Dairy & Alternatives
  'milk': '660768274',
  'butter': '10448679',
  'cheese': '10452399',
  'cheddar': '10452399',
  'cream cheese': '10452358',
  'yogurt': '10450917',
  'greek yogurt': '10450917',

  // Produce
  'banana': '44390948',
  'bananas': '44390948',
  'onion': '44390977',
  'onions': '44390977',
  'garlic': '44390998',
  'potato': '44390953',
  'potatoes': '44390953',
  'tomato': '44391008',
  'tomatoes': '44391008',
  'lemon': '44390975',
  'lemons': '44390975',
  'lime': '44390976',
  'limes': '44390976',
  'strawberry': '44390956',
  'strawberries': '44390956',
  'broccoli': '44390987',
  'spinach': '44391004',
  'bell pepper': '44390991',
  'cucumber': '44390984',

  // Pantry & Staples
  'sugar': '10312049',
  'flour': '10312050',
  'bread': '10315878',
  'rice': '10312111',
  'pasta': '10315758',
  'spaghetti': '10315758',
  'oil': '10312217',
  'olive oil': '10312217',
  'salt': '10312057',
  'pepper': '10314953',
};

/**
 * Perform a fuzzy matching lookup to find the best Walmart Item ID for a given name.
 */
export function getWalmartItemId(itemName: string): string | null {
  const cleanName = itemName.toLowerCase().trim();
  
  // Try exact lookup first
  if (STAPLE_WALMART_MAP[cleanName]) {
    return STAPLE_WALMART_MAP[cleanName];
  }

  // Find if any key is a substring or vice versa
  for (const key of Object.keys(STAPLE_WALMART_MAP)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return STAPLE_WALMART_MAP[key];
    }
  }

  return null;
}

/**
 * Returns true if an item has a mapped Walmart ID.
 */
export function hasWalmartMatch(item: ShoppingItem): boolean {
  return getWalmartItemId(item.item) !== null;
}

/**
 * Generate a direct Walmart Add-to-Cart URL for a list of items.
 * Matched items will be added directly to the cart. Unmatched items are ignored.
 */
export function generateWalmartCartUrl(items: ShoppingItem[], storeId?: string): string | null {
  const cartItems: string[] = [];

  items.forEach(item => {
    const itemId = getWalmartItemId(item.item);
    if (itemId) {
      // Parse amount as integer or default to 1
      let amount = 1;
      if (item.amount) {
        amount = Math.max(1, Math.round(item.amount));
      } else if (typeof item.quantity === 'number') {
        amount = Math.max(1, Math.round(item.quantity));
      } else if (typeof item.quantity === 'string') {
        const parsedAmount = parseFloat(item.quantity);
        if (!isNaN(parsedAmount)) {
          amount = Math.max(1, Math.round(parsedAmount));
        }
      }
      cartItems.push(`${itemId}_${amount}`);
    }
  });

  if (cartItems.length === 0) {
    return null;
  }

  let baseUrl = `https://www.walmart.com/sc/cart/addToCart?items=${cartItems.join(',')}`;
  if (storeId) {
    baseUrl += `&storeId=${storeId}`;
  }

  return baseUrl;
}

/**
 * Generate a search URL on Walmart.com for an unmatched ingredient.
 */
export function generateWalmartSearchUrl(query: string): string {
  return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Wrap a destination Walmart.com URL with the Impact Radius affiliate redirect tracking parameters.
 */
export function wrapWithImpactTracker(destinationUrl: string): string {
  // Read configured credentials from Vite environment
  const accountSid = import.meta.env.VITE_IMPACT_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_IMPACT_AUTH_TOKEN;

  // We also check for publisher campaigns, default to placeholders if not set
  const publisherId = '3624855'; // Sample / fallback publisher ID
  const adId = '1126749'; // Sample / fallback ad ID
  const campaignId = '11463'; // Walmart campaign ID

  // If there are no credentials configured, return the destination URL directly
  if (!accountSid || !authToken) {
    return destinationUrl;
  }

  const encodedUrl = encodeURIComponent(destinationUrl);
  return `https://goto.walmart.com/m/${publisherId}/${adId}/${campaignId}?veh=aff&sourceid=app&u=${encodedUrl}`;
}
