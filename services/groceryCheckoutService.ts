import { ShoppingItem } from '../types';

// Top ~140 most common shopping list staples mapped to standard Walmart Item IDs (UPCs / Catalog IDs)
export const STAPLE_WALMART_MAP: Record<string, string> = {
  'agave nectar': '28187404',
  'allspice': '15920650521',
  'almond butter': '52796493',
  'almond flour': '896217647',
  'almond milk': '143397628',
  'almonds': '834401337',
  'anchovies': '46778639',
  'apple': '15437250773',
  'apple cider vinegar': '139799997',
  'apple juice': '10415325',
  'applesauce': '14562669',
  'apricots': '974611955',
  'artichokes': '386376922',
  'arugula': '17056932',
  'asparagus': '44391242',
  'avocado': '44390968',
  'avocado oil': '535864229',
  'bacon': '10292659',
  'baked beans': '10315221',
  'baking chocolate': '890876952',
  'baking powder': '2040336073',
  'baking soda': '466852488',
  'balsamic vinaigrette': '16618889',
  'balsamic vinegar': '128822499',
  'banana': '51259338',
  'barley': '125570126',
  'basil': '146805115',
  'basil dried': '599534231',
  'basmati rice': '45791914',
  'bay leaves': '14064170733',
  'bbq sauce': '10294615',
  'beef broth': '10899014',
  'beef chuck roast': '8386854802',
  'beef jerky': '830761259',
  'beef ribs': '897429524',
  'bell pepper': '44391581',
  'bell peppers': '44391581',
  'black beans': '20553503',
  'black pepper': '44662573',
  'black tea bags': '10315396',
  'blackberries': '47314798',
  'blue cheese': '558206696',
  'blue cheese dressing': '16618891',
  'blueberries': '1732560925',
  'bok choy': '44391289',
  'bread': '46491799',
  'bread crumbs': '21656980',
  'bread flour': '453570042',
  'broccoli': '51259378',
  'brown rice': '13045034',
  'brown sugar': '10315012',
  'brussels sprouts': '661948092',
  'bulgur wheat': '449121581',
  'butter': '13430201273',
  'buttermilk': '10319960',
  'butternut squash': '44391159',
  'cabbage': '44391042',
  'cacao nibs': '8652720860',
  'caesar dressing': '10452406',
  'canned black beans': '51236573',
  'canned cannellini beans': '22002645',
  'canned coconut cream': '1522874513',
  'canned coconut milk': '1522874513',
  'canned corn': '10315427',
  'canned green beans': '10448318',
  'canned kidney beans': '10534045',
  'canned peach halves': '51091576',
  'canned pears': '10415549',
  'canned peas': '10451509',
  'canned pineapple slices': '15021179',
  'canned pinto beans': '10534043',
  'canned pumpkin': '24538777',
  'canned refried beans': '10534037',
  'canned tuna': '11965048',
  'canola oil': '10450988',
  'cantaloupe': '44390974',
  'capers': '16300624279',
  'caraway seeds': '168046745',
  'cardamom': '109761212',
  'carrot': '10451316',
  'cashews': '1250475020',
  'cauliflower': '10402652',
  'cayenne pepper': '153182042',
  'celery': '51259411',
  'celery salt': '248973865',
  'celery seeds': '261952765',
  'chamomile tea': '927990961',
  'cheddar cheese': '10452477',
  'cheese': '10452429',
  'cherries': '194444821',
  'cherry tomatoes': '44390955',
  'chia seeds': '911473427',
  'chicken breast': '27935840',
  'chicken broth': '10899013',
  'chicken drumsticks': '767913275',
  'chicken noodle soup': '810492047',
  'chicken thighs': '778091348',
  'chicken wings': '409047476',
  'chickpeas': '10534041',
  'chili garlic sauce': '10533372',
  'chili powder': '295849049',
  'chili powder mild': '157643393',
  'chives': '3456542685',
  'chocolate chips': '2341527259',
  'cilantro': '160597260',
  'cinnamon': '47914031',
  'clam chowder': '736686061',
  'cloves whole': '227483667',
  'club soda': '10448533',
  'cocoa powder': '110307843',
  'coconut': '10535750',
  'coconut flakes': '10315401',
  'coconut flour': '225301474',
  'coconut milk canned': '1522874513',
  'coconut oil': '55504318',
  'coconut water': '16939323424',
  'cod': '49914105',
  'coriander': '50597552',
  'corn syrup': '10294409',
  'cornmeal': '13397999',
  'cornstarch': '54802256',
  'couscous': '157638272',
  'crab meat': '612985075',
  'cranberries': '20441600',
  'cranberry juice': '3110529508',
  'cream cheese': '41592222',
  'cream of tartar': '408463270',
  'crushed tomatoes': '10415230',
  'cucumber': '44390954',
  'cumin': '15232811979',
  'curry powder': '1403704344',
  'dark chocolate chips': '890876952',
  'diced tomatoes canned': '10416105',
  'dijon mustard': '10315545',
  'dill': '50597564',
  'dill pickles': '385549101',
  'dill weed': '929950821',
  'dried apricots': '974611955',
  'dried blueberries': '13812848',
  'dried cherries': '13033145',
  'dried figs': '38568525',
  'duck breast': '102953761',
  'eggplant': '44391086',
  'eggs': '145051970',
  'elbow macaroni': '10534076',
  'farro': '16752413280',
  'fennel': '922843670',
  'fennel seeds': '857825134',
  'feta cheese': '21805040',
  'fettuccine': '12329728',
  'figs': '500337657',
  'fish sauce': '400669492',
  'flax seeds': '227294865',
  'flour': '178921158',
  'food coloring': '142803499',
  'french onion soup': '21274651',
  'garam masala': '829508834',
  'garlic': '20553506',
  'garlic powder': '676979470',
  'garlic salt': '339769224',
  'ghee': '810797713',
  'ginger': '44391005',
  'ginger ground': '5283621325',
  'goat cheese': '5129878755',
  'gochujang': '7260864094',
  'graham cracker crumbs': '10315952',
  'grapefruit': '51259387',
  'grapes': '44390943',
  'grapeseed oil': '919508984',
  'greek yogurt': '26559565',
  'green beans': '10448318',
  'green onion': '15556486',
  'green peas': '223902117',
  'green tea bags': '20680639',
  'ground cloves': '305161732',
  'ground turkey': '22210558',
  'guacamole': '259615168',
  'habanero': '14648448',
  'half and half': '14336391',
  'halibut': '346620571',
  'ham': '10316040',
  'harissa': '2658168898',
  'hazelnuts': '383637745',
  'heavy whipping cream': '342483711',
  'herbes de provence': '105089029',
  'hoisin sauce': '38438962',
  'honey': '19857743',
  'honey mustard': '10315532',
  'honeydew': '44391113',
  'horseradish': '926269095',
  'hot sauce': '10313024',
  'italian dressing': '1483262234',
  'italian seasoning': '637648335',
  'jalapeno': '12663616038',
  'jasmine rice': '36874822',
  'kale': '6701815936',
  'ketchup': '15077427',
  'kiwi': '13508117005',
  'kosher salt': '47041180',
  'lamb chops': '20480204627',
  'lard': '10450116',
  'lasagna noodles': '10534110',
  'leeks': '44391102',
  'lemon': '44391659',
  'lemon pepper': '408264184',
  'lemonade': '10416088',
  'lettuce': '10402650',
  'lime': '44391008',
  'macadamia nuts': '499527722',
  'mango': '1920275826',
  'maple syrup': '492758994',
  'marinara sauce': '252522980',
  'marjoram': '158851667',
  'marshmallows': '11303936',
  'mascarpone': '10535844',
  'mayonnaise': '17056888',
  'milk': '10450115',
  'milk chocolate chips': '932430893',
  'mint': '273581692',
  'molasses': '199260962',
  'mozzarella': '10452490',
  'mushroom': '397616308',
  'mustard': '14089343',
  'mustard seeds': '192304824',
  'nutmeg': '3653044183',
  'nutmeg whole': '344742144',
  'oat milk': '766644543',
  'oats': '10314926',
  'okra': '575671694',
  'olive oil': '10316039',
  'olives': '13387420719',
  'onion': '51259212',
  'onion powder': '10535034',
  'onion salt': '168168071',
  'orange': '17810161268',
  'orange juice pulp free': '14574718',
  'oregano': '190466688',
  'oregano dried': '1819183712',
  'oyster sauce': '400669492',
  'panko breadcrumbs': '21651906',
  'paprika': '785841258',
  'parmesan cheese': '19400150',
  'parsley': '44391168',
  'pasta': '687594303',
  'peaches': '51091576',
  'peanut butter': '47375932',
  'peanut oil': '44391266',
  'peanuts': '505842183',
  'pears': '12852163028',
  'pecans': '14966621924',
  'pectin': '10292608',
  'penne pasta': '10534084',
  'peppermint tea': '509341442',
  'pepperoni': '40495518',
  'pesto': '818677155',
  'pico de gallo': '387591794',
  'pine nuts': '804851997',
  'pineapple': '44391200',
  'pistachios': '176833711',
  'pita chips': '387437557',
  'plums': '44391147',
  'polenta': '15395806513',
  'polenta grits': '474785268',
  'pomegranate': '10294367',
  'pork ribs': '51259140',
  'pork tenderloin': '20850646',
  'potato': '10449951',
  'potato starch': '2215662446',
  'poultry seasoning': '377674804',
  'powdered gelatin': '610713289',
  'powdered sugar': '10315011',
  'prosciutto': '17236013941',
  'provolone': '635172556',
  'pumpkin': '15967150337',
  'pumpkin seeds': '11684419625',
  'quinoa': '51258806',
  'radish': '42353640',
  'raisins': '20925296',
  'ranch dressing': '16618888',
  'raspberries': '44391666',
  'red onion': '51259215',
  'red wine vinegar': '10320859',
  'rice': '10804528',
  'rice noodles': '10804528',
  'rice vinegar': '220935703',
  'ricotta cheese': '10315688',
  'rolled oats': '926104307',
  'roma tomatoes': '44390944',
  'romaine lettuce': '44391114',
  'rosemary': '2324449027',
  'rotini pasta': '10534080',
  'rye flour': '10403017',
  'saffron threads': '493821142',
  'salami': '52468057',
  'salmon': '896766595',
  'salsa verde': '2922389780',
  'salt': '10448316',
  'sardines': '380955153',
  'sausage': '43951337',
  'scallions': '44391051',
  'scallops': '826708035',
  'sea salt': '15056186',
  'self-rising flour': '10402992',
  'semolina flour': '464723057',
  'sesame oil': '5024253144',
  'shallots': '10313027',
  'sherry vinegar': '597763688',
  'shortening': '10451501',
  'shrimp': '791288879',
  'smoked paprika': '785841258',
  'snow peas': '13399615',
  'sour cream': '43365585',
  'soy milk': '18874620338',
  'soy sauce': '10315653',
  'spaghetti': '18470712781',
  'spaghetti squash': '44391085',
  'spicy brown mustard': '10315055',
  'spinach': '13893738',
  'sprinkles': '642059820',
  'star anise': '225363329',
  'steak': '21553590',
  'steel cut oats': '127255159',
  'stewed tomatoes': '10415670',
  'strawberry': '10307932',
  'sugar': '10315012',
  'sunflower seed butter': '10423163',
  'sunflower seeds': '3564055710',
  'sushi vinegar': '597763688',
  'sweet chili sauce': '5674252870',
  'sweet corn': '44391430',
  'sweet paprika': '559839182',
  'sweet potato': '132720824',
  'swiss cheese': '198940386',
  'taco seasoning': '10314963',
  'tahini': '2334742274',
  'tahini paste': '2334742274',
  'tapioca flour': '5558067602',
  'tarragon vinegar': '597763688',
  'tartar sauce': '40711364',
  'teriyaki sauce': '5189850679',
  'thousand island dressing': '10452368',
  'thyme': '14140920286',
  'thyme dried': '567535646',
  'tilapia': '123210797',
  'tofu': '10898985',
  'tomato': '44390944',
  'tomato paste': '10415519',
  'tomato puree': '10415230',
  'tomato sauce': '10415493',
  'tomato soup': '10314957',
  'tomatoes': '44390944',
  'tonic water': '10448545',
  'turkey bacon': '5490588995',
  'turkey breast': '22406025',
  'turmeric': '318146370',
  'udon noodles': '29883924',
  'vanilla extract': '10308884',
  'vanilla pudding': '10534174',
  'vegetable broth': '396785612',
  'vegetable oil': '10451002',
  'vegetable soup': '2454765353',
  'walnuts': '1420160710',
  'wasabi': '321234483',
  'watermelon': '44391101',
  'white onion': '31089275',
  'white vinegar': '10450989',
  'white wine vinegar': '524659395',
  'whole wheat flour': '19352066114',
  'wild rice': '10309437',
  'worcestershire sauce': '10308273',
  'xanthan gum': '9757300187',
  'yeast': '443431030',
  'yellow mustard': '25904063',
  'yogurt': '47183344',
  'zucchini': '44390947',
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

const MERCHANT_BRANDS: Record<string, string> = {
  walmart: 'Great Value',
  target: 'Good & Gather',
  kroger: 'Kroger',
  albertsons: 'Signature Select',
  thrive: 'Thrive Market',
};

/**
 * Check if the query refers to a common shopping staple ingredient.
 */
function isStapleIngredient(query: string): boolean {
  const cleanQuery = query.toLowerCase().trim();
  for (const staple of Object.keys(STAPLE_WALMART_MAP)) {
    if (cleanQuery.includes(staple) || staple.includes(cleanQuery)) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a search URL on the specified merchant's site for an ingredient.
 */
export function generateSearchUrl(query: string, merchant: 'walmart' | 'target' | 'kroger' | 'instacart' | 'albertsons' | 'thrive'): string {
  let searchQuery = query;

  // Apply store brand search affinity if the item is a basic staple and has a configured brand
  if (isStapleIngredient(query) && MERCHANT_BRANDS[merchant]) {
    const brand = MERCHANT_BRANDS[merchant];
    if (!query.toLowerCase().includes(brand.toLowerCase())) {
      searchQuery = `${brand} ${query}`;
    }
  }

  const encodedQuery = encodeURIComponent(searchQuery);
  switch (merchant) {
    case 'walmart':
      return `https://www.walmart.com/search?q=${encodedQuery}`;
    case 'target':
      return `https://www.target.com/s?searchTerm=${encodedQuery}`;
    case 'kroger':
      return `https://www.kroger.com/search?query=${encodedQuery}`;
    case 'instacart':
      return `https://www.instacart.com/store/partner/search/${encodedQuery}`;
    case 'albertsons':
      return `https://www.albertsons.com/shop/search-results.html?q=${encodedQuery}`;
    case 'thrive':
      return `https://thrivemarket.com/page/search?q=${encodedQuery}`;
    default:
      return `https://www.walmart.com/search?q=${encodedQuery}`;
  }
}

/**
 * Wrap a destination merchant URL with the Impact Radius affiliate redirect tracking parameters.
 * Supports different redirect subdomains and campaign details based on the retailer.
 * Only wraps with affiliate tracking if the specific merchant's Campaign ID and Ad ID are configured
 * in the environment variables, falling back to direct merchant links to avoid redirect errors.
 */
export function wrapWithImpactTracker(
  destinationUrl: string,
  merchant: 'walmart' | 'target' | 'kroger' | 'instacart' | 'albertsons' | 'thrive' = 'walmart'
): string {
  // Read configured credentials from Vite environment
  const accountSid = import.meta.env.VITE_IMPACT_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_IMPACT_AUTH_TOKEN;

  // Fallback: If no credentials configured, return the destination URL directly
  if (!accountSid || !authToken) {
    return destinationUrl;
  }

  let campaignId = '';
  let adId = '';
  let trackingDomain = '';

  const publisherId = import.meta.env.VITE_IMPACT_PUBLISHER_ID || '3624855';

  switch (merchant) {
    case 'walmart':
      campaignId = import.meta.env.VITE_WALMART_CAMPAIGN_ID;
      adId = import.meta.env.VITE_WALMART_AD_ID;
      trackingDomain = 'goto.walmart.com';
      break;
    case 'target':
      campaignId = import.meta.env.VITE_TARGET_CAMPAIGN_ID;
      adId = import.meta.env.VITE_TARGET_AD_ID;
      trackingDomain = 'target.sjv.io';
      break;
    case 'kroger':
      campaignId = import.meta.env.VITE_KROGER_CAMPAIGN_ID;
      adId = import.meta.env.VITE_KROGER_AD_ID;
      trackingDomain = 'kroger.sjv.io';
      break;
    case 'instacart':
      campaignId = import.meta.env.VITE_INSTACART_CAMPAIGN_ID;
      adId = import.meta.env.VITE_INSTACART_AD_ID;
      trackingDomain = 'instacart.sjv.io';
      break;
    case 'albertsons':
      campaignId = import.meta.env.VITE_ALBERTSONS_CAMPAIGN_ID;
      adId = import.meta.env.VITE_ALBERTSONS_AD_ID;
      trackingDomain = 'albertsons.sjv.io';
      break;
    case 'thrive':
      campaignId = import.meta.env.VITE_THRIVE_CAMPAIGN_ID;
      adId = import.meta.env.VITE_THRIVE_AD_ID;
      trackingDomain = 'thrivemarket.pxf.io';
      break;
  }

  // Fallback: If campaign and ad details are not configured for this specific merchant,
  // return direct link to prevent 403, expired or malformed link errors on placeholder IDs.
  if (!campaignId || !adId) {
    return destinationUrl;
  }

  const encodedUrl = encodeURIComponent(destinationUrl);
  return `https://${trackingDomain}/m/${publisherId}/${adId}/${campaignId}?veh=aff&sourceid=app&u=${encodedUrl}`;
}
