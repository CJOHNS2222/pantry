import { ShoppingItem } from '../types';

// Top ~140 most common shopping list staples mapped to standard Walmart Item IDs (UPCs / Catalog IDs)
export const STAPLE_WALMART_MAP: Record<string, string> = {
  // Proteins & Seafood
  'chicken breast': '51259021',
  'chicken': '51259021',
  'chicken thighs': '51259022',
  'chicken wings': '51259025',
  'ground beef': '51259005',
  'beef': '51259005',
  'steak': '51259005',
  'ribeye': '51259008',
  'sirloin': '51259005',
  'flank steak': '51259005',
  'pork': '10448679',
  'pork chops': '51259050',
  'pork tenderloin': '51259051',
  'ham': '10315982',
  'salmon': '172844781',
  'fish': '172844781',
  'cod': '172844890',
  'shrimp': '10451300',
  'tuna': '10315352',
  'canned tuna': '10315352',
  'bacon': '10315998',
  'turkey bacon': '10316024',
  'sausage': '10316003',
  'turkey': '9.50',
  'ground turkey': '51259015',
  'ground pork': '51259005',
  'eggs': '172844358',
  'tofu': '10452445',
  'black beans': '10314902',
  'chickpeas': '10314909',
  'garbanzo beans': '10314909',

  // Dairy & Alternatives
  'milk': '660768274',
  'butter': '10448679',
  'ghee': '10448679',
  'cheese': '10452399',
  'cheddar': '10452399',
  'mozzarella': '10452401',
  'parmesan': '10452395',
  'feta': '10452399',
  'goat cheese': '10452399',
  'swiss cheese': '10452399',
  'provolone': '10452399',
  'ricotta': '10452355',
  'cream cheese': '10452358',
  'sour cream': '10450920',
  'heavy cream': '10450914',
  'heavy whipping cream': '10450914',
  'half and half': '10450915',
  'yogurt': '10450917',
  'greek yogurt': '10450917',
  'cottage cheese': '10450917',
  'almond milk': '10313498',
  'coconut milk': '10315694',
  'oat milk': '10313498',
  'soy milk': '10313498',

  // Produce - Fruits
  'banana': '44390948',
  'bananas': '44390948',
  'apple': '44390941',
  'apples': '44390941',
  'orange': '44390971',
  'oranges': '44390971',
  'grape': '44390962',
  'grapes': '44390962',
  'strawberry': '44390956',
  'strawberries': '44390956',
  'blueberry': '44390957',
  'blueberries': '44390957',
  'raspberry': '44390958',
  'raspberries': '44390958',
  'blackberry': '44390958',
  'blackberries': '44390958',
  'avocado': '44390947',
  'avocados': '44390947',
  'grapefruit': '44390971',
  'lemon': '44390975',
  'lemons': '44390975',
  'lime': '44390976',
  'limes': '44390976',
  'peach': '44390945',
  'peaches': '44390945',
  'pineapple': '44390945',
  'mango': '44390949',
  'kiwi': '44390950',
  'watermelon': '44390945',
  'cantaloupe': '44390945',

  // Produce - Vegetables & Herbs
  'onion': '44390977',
  'onions': '44390977',
  'garlic': '44390998',
  'potato': '44390953',
  'potatoes': '44390953',
  'sweet potato': '44390954',
  'sweet potatoes': '44390954',
  'tomato': '44391008',
  'tomatoes': '44391008',
  'broccoli': '44390987',
  'spinach': '44391004',
  'bell pepper': '44390991',
  'peppers': '44390991',
  'red bell pepper': '44390992',
  'green bell pepper': '44390991',
  'yellow bell pepper': '44390992',
  'cucumber': '44390984',
  'cucumbers': '44390984',
  'carrot': '44390968',
  'carrots': '44390968',
  'celery': '44390989',
  'mushroom': '44391001',
  'mushrooms': '44391001',
  'asparagus': '44390986',
  'zucchini': '44390982',
  'cauliflower': '44390988',
  'cabbage': '44390983',
  'brussels sprouts': '44390985',
  'kale': '44391004',
  'lettuce': '44390993',
  'romaine': '44390993',
  'arugula': '44391004',
  'radish': '44390968',
  'radishes': '44390968',
  'eggplant': '44390982',
  'jalapeno': '44390994',
  'jalapenos': '44390994',
  'shallots': '44390978',
  'leeks': '44390978',
  'cilantro': '44391011',
  'parsley': '44391012',
  'basil': '44391014',
  'green onion': '44391010',
  'scallions': '44391010',
  'ginger': '44391019',

  // Pantry, Baking & Grains
  'sugar': '10312049',
  'white sugar': '10312049',
  'powdered sugar': '10312047',
  'brown sugar': '10312048',
  'flour': '10312050',
  'honey': '10312520',
  'maple syrup': '10312525',
  'vanilla extract': '10312271',
  'baking powder': '10312061',
  'baking soda': '10312062',
  'cornstarch': '10312064',
  'yeast': '10312061',
  'bread': '10315878',
  'rice': '10312111',
  'brown rice': '10312110',
  'jasmine rice': '10312111',
  'oats': '10312099',
  'oatmeal': '10312099',
  'quinoa': '10312130',
  'pasta': '10315758',
  'spaghetti': '10315758',
  'bread crumbs': '10315002',
  'panko': '10315002',
  'oil': '10312217',
  'olive oil': '10312217',
  'canola oil': '10312211',
  'coconut oil': '10312222',
  'vegetable oil': '10312211',
  'sesame oil': '10312219',
  'salt': '10312057',
  'kosher salt': '10312057',
  'sea salt': '10312057',
  'pepper': '10314953',
  'black pepper': '10314953',

  // Condiments, Sauces & Vinegars
  'soy sauce': '10312282',
  'ketchup': '10318536',
  'mustard': '10318544',
  'mayonnaise': '10318530',
  'hot sauce': '10312781',
  'sriracha': '10312781',
  'bbq sauce': '10318536',
  'peanut butter': '10318625',
  'worcestershire': '10312282',
  'salsa': '10314942',
  'marinara': '10314940',
  'tomato paste': '10314945',
  'tomato sauce': '10314940',
  'diced tomatoes': '10314942',
  'chicken broth': '10314840',
  'chicken stock': '10314840',
  'beef broth': '10314842',
  'vegetable broth': '10314843',
  'apple cider vinegar': '10312290',
  'balsamic vinegar': '10312292',
  'red wine vinegar': '10312290',
  'white vinegar': '10312290',

  // Snacks & Nuts
  'almonds': '10312088',
  'walnuts': '10312089',
  'pecans': '10312090',
  'cashews': '10312091',
  'peanuts': '10312091',
  'chia seeds': '10312130',
  'flax seeds': '10312130',
  'raisins': '10312088',
  'cranberries': '10312088',

  // Spices (Ground)
  'garlic powder': '10314954',
  'onion powder': '10314955',
  'chili powder': '10314956',
  'cayenne pepper': '10314957',
  'ground cumin': '10314954',
  'ground cinnamon': '10314954',
  'ground ginger': '10314954',
  'turmeric': '10314954',
  'oregano': '10314954',
  'paprika': '10314954',
  'rosemary': '10314954',
  'thyme': '10314954',
};

/**
 * Perform a fuzzy matching lookup to find the best Walmart Item ID for a given name.
 */
export function getWalmartItemId(itemName: string, itemObj?: ShoppingItem): string | null {
  // If the item object is passed and has a custom mapped ID, use that first
  if (itemObj?.walmartItemId) {
    return itemObj.walmartItemId;
  }

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
  return !!item.walmartItemId || getWalmartItemId(item.item) !== null;
}

/**
 * Generate a direct Walmart Add-to-Cart URL for a list of items.
 * Matched items will be added directly to the cart. Unmatched items are ignored.
 */
export function generateWalmartCartUrl(items: ShoppingItem[], storeId?: string): string | null {
  const cartItems: string[] = [];

  items.forEach(item => {
    const itemId = getWalmartItemId(item.item, item);
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
