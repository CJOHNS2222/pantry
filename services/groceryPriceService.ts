import DatabaseMonitoringService from './databaseMonitoringService';
import { collection as firestoreCollection, query as firestoreQuery, where as firestoreWhere, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PriceTrend } from '../types/app';
import { priceCacheService } from './priceCacheService';
import { log } from './logService';

export interface GroceryPrice {
  id: string;
  ingredient: string;
  price: number;
  unit: string;
  store?: string;
  location?: string;
  currency: string;
  lastUpdated: Date;
  source: 'user' | 'api' | 'crowdsourced';
  userId?: string;
  votes?: number;
}

export interface PriceData {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  lastUpdated: Date;
  unit: string;
}

// Open Prices API interfaces
export interface OpenPricesProduct {
  id: string;
  product_name: string;
  brands?: string;
  categories?: string[];
  image_url?: string;
}

export interface OpenPricesPrice {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  location?: string;
  store?: string;
  date: string;
  proof_url?: string;
}

export interface OpenPricesResponse {
  items: OpenPricesPrice[];
  page: number;
  pages: number;
  size: number;
  total: number;
}

class GroceryPriceService {
  private readonly COLLECTION_NAME = 'groceryPrices';
  private readonly PRICE_HISTORY_COLLECTION = 'priceHistory';

  // Default prices — local area averages used as fallback when no crowdsourced/API data is available.
  // Keys must match normalizeIngredientName() output (lowercase + trim).
  // Canonical price data — one entry per unique product. Aliases (synonyms,
  // singular/plural, "canned X" / "X" variants) resolve through PRICE_ALIASES
  // below instead of duplicating the price/unit here (PERF-022).
  private static readonly CANONICAL_PRICES: Record<string, { price: number; unit: string }> = {
    // === PROTEINS ===
    'chicken': { price: 3.99, unit: 'lb' },
    'ground beef': { price: 5.99, unit: 'lb' },
    'pork': { price: 4.4, unit: 'lb' },
    'fish': { price: 8.99, unit: 'lb' },
    'salmon': { price: 12.99, unit: 'lb' },
    'bacon': { price: 6.95, unit: 'lb' },
    'deli turkey': { price: 9.5, unit: 'lb' },
    // === DAIRY ===
    'eggs': { price: 3.49, unit: 'dozen' },
    'milk': { price: 3.99, unit: 'gallon' },
    'cheese': { price: 5.5, unit: 'lb' },
    'shredded cheddar': { price: 2.75, unit: '8 oz bag' },
    'cream cheese': { price: 3.1, unit: '8 oz' },
    'yogurt': { price: 5.45, unit: '32 oz tub' },
    'butter': { price: 4.85, unit: 'lb' },
    // === PRODUCE ===
    'apple': { price: 1.98, unit: 'lb' },
    'banana': { price: 0.79, unit: 'lb' },
    'strawberries': { price: 3.65, unit: 'lb' },
    'lemon': { price: 0.65, unit: 'each' },
    'lime': { price: 0.89, unit: 'each' },
    'onion': { price: 1.08, unit: 'lb' },
    'yellow onions': { price: 3.25, unit: '3 lb bag' },
    'tomato': { price: 2.45, unit: 'lb' },
    'bell pepper': { price: 0.85, unit: 'each' },
    'broccoli': { price: 2.2, unit: 'lb' },
    'lettuce': { price: 1.95, unit: 'head' },
    'garlic': { price: 0.79, unit: 'head' },
    'carrot': { price: 1.49, unit: 'lb' },
    'potato': { price: 0.89, unit: 'lb' },
    'cucumber': { price: 1.49, unit: 'each' },
    'spinach': { price: 3.99, unit: 'bag' },
    // === BEVERAGES ===
    'orange juice': { price: 4.95, unit: '52 oz carton' },
    'coffee': { price: 8.99, unit: 'lb' },
    'soda': { price: 8.5, unit: '12-pack' },
    // === PANTRY STAPLES ===
    'flour': { price: 3.95, unit: '5 lb bag' },
    'sugar': { price: 2.49, unit: 'lb' },
    'rice': { price: 4.15, unit: '5 lb bag' },
    'pasta': { price: 1.45, unit: 'box' },
    'bread': { price: 3.49, unit: 'loaf' },
    'olive oil': { price: 10.5, unit: '16.9 oz bottle' },
    'oil': { price: 5.99, unit: 'bottle' },
    'salt': { price: 1.49, unit: 'container' },
    'pepper': { price: 2.99, unit: 'container' },
    'peanut butter': { price: 2.95, unit: 'jar' },
    'marinara sauce': { price: 3.15, unit: 'jar' },
    'canned tomatoes': { price: 1.25, unit: 'can' },
    'ghee': { price: 6.99, unit: '13 oz jar' },
    'worcestershire': { price: 2.49, unit: '10 oz bottle' },
    'maple syrup': { price: 6.99, unit: '12 oz bottle' },
    'ketchup': { price: 2.29, unit: '20 oz bottle' },
    'mustard': { price: 1.49, unit: '14 oz bottle' },
    'mayonnaise': { price: 3.89, unit: '30 oz jar' },
    'hot sauce': { price: 1.99, unit: '12 oz bottle' },
    'canned beans': { price: 1.15, unit: 'can' },
    // === FROZEN & SNACKS ===
    'frozen vegetables': { price: 1.65, unit: 'bag' },
    'frozen pizza': { price: 6.25, unit: 'pizza' },
    'ice cream': { price: 5.5, unit: '1.5 qt tub' },
    'cereal': { price: 4.8, unit: 'box' },
    // === SPICES & SEASONINGS ===
    'cumin': { price: 4.99, unit: 'oz' },
    'paprika': { price: 3.99, unit: 'oz' },
    'oregano': { price: 3.49, unit: 'oz' },
    'thyme': { price: 3.99, unit: 'oz' },
    'basil': { price: 3.49, unit: 'oz' },
    'cinnamon': { price: 4.49, unit: 'oz' },
    'nutmeg': { price: 5.99, unit: 'oz' },
    // === EXPANDED ITEMS (101-200) ===
    'raspberries': { price: 3.49, unit: '6 oz clamshell' },
    'blackberries': { price: 3.29, unit: '6 oz clamshell' },
    'honeycrisp apples': { price: 2.49, unit: '1 lb' },
    'kiwi': { price: 2.49, unit: 'pack of 4' },
    'green onions (scallions)': { price: 0.89, unit: 'bunch' },
    'fresh cilantro': { price: 0.89, unit: 'bunch' },
    'fresh parsley': { price: 0.89, unit: 'bunch' },
    'brussels sprouts': { price: 2.99, unit: '1 lb' },
    'cauliflower': { price: 3.29, unit: 'head' },
    'green cabbage': { price: 0.89, unit: '1 lb' },
    'red radish': { price: 1.15, unit: 'bunch' },
    'jalapeno peppers': { price: 1.89, unit: '1 lb' },
    'sweet corn': { price: 0.5, unit: 'per ear' },
    'fresh ginger root': { price: 3.99, unit: '1 lb' },
    'portobello mushrooms': { price: 3.49, unit: '6 oz pack' },
    'butternut squash': { price: 1.29, unit: '1 lb' },
    'beef flank steak': { price: 11.99, unit: '1 lb' },
    'beef sirloin steak': { price: 9.49, unit: '1 lb' },
    'ground pork': { price: 3.99, unit: '1 lb' },
    'chicken wings': { price: 3.49, unit: '1 lb' },
    'turkey bacon': { price: 4.99, unit: '12 oz pack' },
    'tilapia fillets': { price: 5.99, unit: '1 lb (frozen)' },
    'cod fillets': { price: 10.99, unit: '1 lb (frozen)' },
    'canned pink salmon': { price: 4.49, unit: '14.75 oz can' },
    'firm tofu': { price: 2.49, unit: '14 oz block' },
    'plant-based burger patties': { price: 5.49, unit: '8 oz (2 pack)' },
    'cornish game hen': { price: 4.99, unit: 'each' },
    'lamb chops': { price: 15.99, unit: '1 lb' },
    'prosciutto slices': { price: 4.99, unit: '3 oz pack' },
    'deli salami slices': { price: 4.49, unit: '8 oz pack' },
    'grass-fed beef': { price: 8.79, unit: '1 lb' },
    'soy milk': { price: 3.89, unit: '0.5 gallon' },
    'oat milk': { price: 4.19, unit: '64 oz carton' },
    'coconut milk (beverage)': { price: 3.99, unit: '64 oz carton' },
    'salted butter': { price: 4.49, unit: '16 oz (4 sticks)' },
    'parmesan cheese wedge': { price: 5.49, unit: 'each' },
    'goat cheese log': { price: 3.99, unit: '4 oz block' },
    'feta cheese crumbles': { price: 3.89, unit: '6 oz tub' },
    'swiss cheese slices': { price: 3.49, unit: '8 oz pack' },
    'provolone cheese slices': { price: 3.29, unit: '8 oz pack' },
    'pepper jack cheese block': { price: 2.75, unit: '8 oz block' },
    'ricotta cheese': { price: 3.49, unit: '15 oz tub' },
    'dairy-free cheese': { price: 4.19, unit: '8 oz bag' },
    'whipped cream aerosol': { price: 2.89, unit: '6.5 oz can' },
    'margarine tub spread': { price: 2.75, unit: '15 oz tub' },
    'organic large brown eggs': { price: 4.99, unit: '1 dozen' },
    'light brown sugar': { price: 2.29, unit: '2 lb bag' },
    'powdered sugar': { price: 2.29, unit: '2 lb bag' },
    'baking soda': { price: 0.99, unit: '16 oz box' },
    'baking powder': { price: 2.49, unit: '8.1 oz canister' },
    'pure vanilla extract': { price: 9.99, unit: '2 oz bottle' },
    'unsweetened cocoa powder': { price: 3.75, unit: '8 oz tub' },
    'soy sauce': { price: 2.69, unit: '15 oz bottle' },
    'sriracha hot sauce': { price: 4.99, unit: '17 oz bottle' },
    'bbq sauce': { price: 2.29, unit: '18 oz bottle' },
    'balsamic vinegar': { price: 4.5, unit: '16.9 oz bottle' },
    'apple cider vinegar': { price: 3.49, unit: '32 oz bottle' },
    'white distilled vinegar': { price: 2.29, unit: '64 oz' },
    'canola oil': { price: 3.99, unit: '48 oz bottle' },
    'canned chickpeas (garbanzo)': { price: 0.99, unit: '15 oz can' },
    'canned cannellini (white bean)': { price: 1.15, unit: '15.5 oz can' },
    'garlic powder': { price: 1.75, unit: '3.12 oz spice jar' },
    'onion powder': { price: 1.75, unit: '3 oz spice jar' },
    'chili powder': { price: 1.75, unit: '2.5 oz spice jar' },
    'ground cinnamon': { price: 1.89, unit: '2.37 oz spice jar' },
    'oregano leaves': { price: 1.89, unit: '0.75 oz spice jar' },
    'frozen potstickers / dumplings': { price: 4.99, unit: '16 oz bag' },
    'frozen breakfast sandwiches': { price: 5.49, unit: '4 count box' },
    'frozen whole strawberries': { price: 3.49, unit: '16 oz bag' },
    'frozen peas & carrots': { price: 1.25, unit: '12 oz bag' },
    'frozen sweet corn': { price: 1.25, unit: '12 oz bag' },
    'frozen broccoli florets': { price: 1.49, unit: '12 oz bag' },
    'frozen chicken nuggets': { price: 6.99, unit: '32 oz bag' },
    'frozen hash brown patties': { price: 3.29, unit: '10 count box' },
    'frozen garlic bread': { price: 2.99, unit: '16 oz box (2ct)' },
    'frozen breaded fish sticks': { price: 5.99, unit: '24 oz box' },
    'raw whole almonds': { price: 6.99, unit: '16 oz bag' },
    'halves & pieces walnuts': { price: 5.99, unit: '16 oz bag' },
    'dry roasted peanuts': { price: 2.49, unit: '16 oz jar' },
    'pita crackers': { price: 3.29, unit: '5.3 oz box' },
    'honey graham crackers': { price: 3.69, unit: '14.4 oz box' },
    'instant mac & cheese cup': { price: 1.25, unit: 'single (2.05 oz) cup' },
    'instant ramen noodles': { price: 3.49, unit: '12 pack box' },
    'gummy bear candy': { price: 1.99, unit: '8 oz bag' },
    'jelly bean candy': { price: 2.75, unit: '14 oz bag' },
    'milk chocolate candy bar': { price: 1.25, unit: 'standard (1.55 oz) bar' },
    'cranberry juice cocktail': { price: 3.49, unit: '64 oz bottle' },
    'tomato juice': { price: 1.89, unit: '46 oz can' },
    'flavored seltzer water': { price: 4.89, unit: '12 pack (12 oz cans)' },
    'ginger ale soda': { price: 7.99, unit: '12 pack (12 oz cans)' },
    'club soda': { price: 1.49, unit: '1 Liter bottle' },
    'tonic water': { price: 1.49, unit: '1 Liter bottle' },
    'decaf espresso pods': { price: 6.99, unit: '10 count pack' },
    'hot cocoa mix envelopes': { price: 2.89, unit: '10 count box' },
    'semi-sweet chocolate chips': { price: 2.79, unit: '12 oz bag' },
    'mini marshmallows': { price: 1.49, unit: '10 oz bag' },
    // === EXPANDED ITEMS (201-300) ===
    'quinoa': { price: 3.99, unit: '16 oz bag' },
    'brown rice': { price: 2.19, unit: '2 lb bag' },
    'jasmine rice': { price: 6.29, unit: '5 lb bag' },
    'panko breadcrumbs': { price: 2.49, unit: '8 oz box' },
    'yellow cornmeal': { price: 2.29, unit: '24 oz bag' },
    'active dry yeast': { price: 2.29, unit: '3-pack strip (0.75 oz)' },
    'coconut milk (canned)': { price: 1.89, unit: '13.5 oz can' },
    'rice vinegar': { price: 2.49, unit: '10 oz bottle' },
    'pure sesame oil': { price: 3.89, unit: '5 oz bottle' },
    'premium fish sauce': { price: 2.99, unit: '6.7 oz bottle' },
    'hoisin sauce': { price: 3.49, unit: '15 oz bottle' },
    'traditional rolled barley': { price: 1.99, unit: '16 oz bag' },
    'diced green chilies': { price: 0.89, unit: '4 oz can' },
    'red enchilada sauce': { price: 1.89, unit: '10 oz can' },
    'gluten-free flour': { price: 4.49, unit: '22 oz bag' },
    'ranch dressing': { price: 3.49, unit: '16 oz bottle' },
    'italian dressing': { price: 2.89, unit: '16 oz bottle' },
    'creamy caesar dressing': { price: 3.49, unit: '16 oz bottle' },
    'balsamic vinaigrette': { price: 3.79, unit: '16 oz bottle' },
    'sweet & sour sauce': { price: 2.29, unit: '12 oz bottle' },
    'kosher dill pickle spears': { price: 3.29, unit: '24 oz jar' },
    'sweet relish': { price: 2.49, unit: '12 oz squeeze' },
    'pitted black olives': { price: 1.89, unit: '6 oz can' },
    'green olives (stuffed)': { price: 2.29, unit: '5.75 oz jar' },
    'capers (in brine)': { price: 2.49, unit: '3.5 oz jar' },
    'basil pesto sauce': { price: 3.89, unit: '6.7 oz jar' },
    'creamy alfredo sauce': { price: 3.49, unit: '15 oz jar' },
    'worcestershire sauce': { price: 2.89, unit: '10 oz bottle' },
    'hot sauce (cayenne)': { price: 3.79, unit: '12 oz bottle' },
    'pizza sauce': { price: 1.99, unit: '14 oz jar' },
    'blue cheese crumbles': { price: 3.89, unit: '5 oz tub' },
    'fresh mozzarella ball': { price: 3.99, unit: '8 oz' },
    'brie cheese wheel': { price: 5.49, unit: '8 oz' },
    'low-moisture string cheese': { price: 3.89, unit: '12 count pack' },
    'sharp cheddar block': { price: 2.89, unit: '8 oz block' },
    'deli American cheese': { price: 3.89, unit: '12 oz (16 slices)' },
    'classic hummus': { price: 3.49, unit: '10 oz tub' },
    'fresh basil': { price: 2.29, unit: '0.75 oz' },
    'pimento cheese spread': { price: 3.79, unit: '12 oz tub' },
    'smoked ham slices': { price: 6.99, unit: '1 lb tub' },
    'southern style potato salad': { price: 3.49, unit: '16 oz tub' },
    'creamy cole slaw': { price: 2.99, unit: '16 oz tub' },
    'rotisserie chicken': { price: 7.99, unit: 'whole (cooked)' },
    'grass-fed butter': { price: 3.89, unit: '8 oz' },
    'frozen family size lasagna': { price: 8.49, unit: '34 oz box' },
    'frozen chicken pot pie': { price: 1.49, unit: 'single (7 oz)' },
    'frozen garlic breadsticks': { price: 2.89, unit: '6 count box' },
    'frozen mozzarella sticks': { price: 4.49, unit: '11 oz bag' },
    'frozen tater tots': { price: 3.49, unit: '32 oz bag' },
    'frozen battered onion rings': { price: 3.89, unit: '16 oz bag' },
    'frozen sweet potato fries': { price: 3.99, unit: '20 oz bag' },
    'frozen chopped spinach': { price: 1.25, unit: '10 oz microwave bag' },
    'frozen sweet peas & carrots': { price: 1.49, unit: '12 oz bag' },
    'frozen breakfast hashbrowns': { price: 3.29, unit: '30 oz bag' },
    'frozen blueberry waffles': { price: 2.89, unit: '10 count box' },
    'frozen breakfast burritos': { price: 6.49, unit: '8 count box' },
    'ice cream bars (chocolate coated)': { price: 4.49, unit: '6 count box' },
    'frozen triple berry smoothie mix': { price: 7.99, unit: '48 oz bag' },
    'frozen rainbow sherbet': { price: 3.49, unit: '48 oz tub' },
    'premium sparkling water': { price: 3.99, unit: '8 pack (12 oz cans)' },
    'sugar-free energy drink': { price: 2.49, unit: 'single (16 oz can)' },
    'electrolyte sports drink': { price: 1.49, unit: '32 oz bottle' },
    'diet cola soda': { price: 7.99, unit: '12 pack (12 oz cans)' },
    'lemon lime soda': { price: 7.99, unit: '12 pack (12 oz cans)' },
    'old fashioned root beer': { price: 2.19, unit: '2 Liter bottle' },
    'chilled sweetened iced tea': { price: 3.29, unit: 'gallon jug' },
    'unsweetened cold brew coffee': { price: 5.49, unit: '48 oz bottle' },
    'single-serve coffee pods': { price: 7.99, unit: '12 count box' },
    'whole coffee beans': { price: 8.49, unit: '12 oz bag' },
    'pure green tea': { price: 2.49, unit: '20 count box' },
    'lemonade bottle': { price: 2.89, unit: '59 oz bottle' },
    '100% grapefruit juice': { price: 4.29, unit: '59 oz bottle' },
    'peach nectar': { price: 2.69, unit: '33.8 oz carton' },
    'pure coconut water': { price: 3.89, unit: '33.8 oz carton' },
    'double-roll paper towels': { price: 8.99, unit: '6 count pack' },
    'ultra soft bath tissue': { price: 11.49, unit: '12 mega rolls' },
    'facial tissues': { price: 4.99, unit: '3-pack box' },
    '13-gallon drawstring trash bags': { price: 8.99, unit: '40 count box' },
    'ultra liquid dish soap': { price: 3.99, unit: '32.5 oz bottle' },
    'dishwasher detergent actionpacs': { price: 5.99, unit: '24 count tub' },
    'liquid laundry detergent (original)': { price: 12.99, unit: '92 oz bottle' },
    'fabric softener sheets': { price: 5.49, unit: '120 count box' },
    'clinging bleach toilet bowl gel': { price: 2.69, unit: '24 oz bottle' },
    'disinfecting wipes': { price: 4.89, unit: '75 count canister' },
    'multi-surface cleaner spray': { price: 3.89, unit: '32 oz spray bottle' },
    'standard aluminum foil': { price: 3.29, unit: '75 sq ft roll' },
    'plastic food wrap': { price: 2.59, unit: '200 sq ft roll' },
    'zipper sandwich bags': { price: 3.29, unit: '90 count box' },
    'zipper freezer bags (gallon)': { price: 4.19, unit: '30 count box' },
    'honey nut toasted oats cereal': { price: 4.79, unit: '15.4 oz box' },
    'frosted flakes cereal': { price: 4.49, unit: '13.5 oz box' },
    'maple brown sugar oatmeal packets': { price: 3.49, unit: '10 count box' },
    'complete pancake & waffle mix': { price: 2.89, unit: '32 oz box' },
    'frosted strawberry pop-tarts': { price: 3.29, unit: '8 count box' },
    'instant grits': { price: 3.29, unit: '12 count box' },
    'steel cut oats': { price: 3.89, unit: '30 oz canister' },
    'old fashioned rolled oats': { price: 4.89, unit: '42 oz canister' },
    'yellow corn tortillas': { price: 2.89, unit: '80 ct bag' },
    'original wheat crackers': { price: 3.29, unit: '9 oz box' },
  };

  // Alias name -> canonical name in CANONICAL_PRICES.
  private static readonly PRICE_ALIASES: Record<string, string> = {
    'beef': 'ground beef',
    'pork chops': 'pork',
    'cheddar cheese': 'shredded cheddar',
    'greek yogurt': 'yogurt',
    'apples': 'apple',
    'bananas': 'banana',
    'lemons': 'lemon',
    'onions': 'onion',
    'tomatoes': 'tomato',
    'fresh tomatoes': 'tomato',
    'bell peppers': 'bell pepper',
    'broccoli crowns': 'broccoli',
    'iceberg lettuce': 'lettuce',
    'carrots': 'carrot',
    'potatoes': 'potato',
    'all-purpose flour': 'flour',
    'white rice': 'rice',
    'dry pasta': 'pasta',
    'tomato sauce': 'marinara sauce',
    'diced tomatoes': 'canned tomatoes',
    'black beans': 'canned beans',
    'pinto beans': 'canned beans',
    'green onions': 'green onions (scallions)',
    'scallions': 'green onions (scallions)',
    'cilantro': 'fresh cilantro',
    'parsley': 'fresh parsley',
    'cabbage': 'green cabbage',
    'jalapenos': 'jalapeno peppers',
    'ginger': 'fresh ginger root',
    'radishes': 'red radish',
    'flank steak': 'beef flank steak',
    'sirloin steak': 'beef sirloin steak',
    'tilapia': 'tilapia fillets',
    'cod': 'cod fillets',
    'tofu': 'firm tofu',
    'prosciutto': 'prosciutto slices',
    'salami': 'deli salami slices',
    'coconut milk': 'coconut milk (beverage)',
    'parmesan': 'parmesan cheese wedge',
    'goat cheese': 'goat cheese log',
    'feta': 'feta cheese crumbles',
    'swiss cheese': 'swiss cheese slices',
    'provolone': 'provolone cheese slices',
    'pepper jack cheese': 'pepper jack cheese block',
    'ricotta': 'ricotta cheese',
    'whipped cream': 'whipped cream aerosol',
    'margarine': 'margarine tub spread',
    'brown sugar': 'light brown sugar',
    'vanilla extract': 'pure vanilla extract',
    'cocoa powder': 'unsweetened cocoa powder',
    'sriracha': 'sriracha hot sauce',
    'canned chickpeas': 'canned chickpeas (garbanzo)',
    'chickpeas': 'canned chickpeas (garbanzo)',
    'garbanzo beans': 'canned chickpeas (garbanzo)',
    'canned white beans': 'canned cannellini (white bean)',
    'white beans': 'canned cannellini (white bean)',
    'cannellini beans': 'canned cannellini (white bean)',
    'frozen potstickers': 'frozen potstickers / dumplings',
    'frozen dumplings': 'frozen potstickers / dumplings',
    'potstickers': 'frozen potstickers / dumplings',
    'dumplings': 'frozen potstickers / dumplings',
    'breakfast sandwiches': 'frozen breakfast sandwiches',
    'frozen strawberries': 'frozen whole strawberries',
    'peas & carrots': 'frozen peas & carrots',
    'frozen broccoli': 'frozen broccoli florets',
    'chicken nuggets': 'frozen chicken nuggets',
    'hash brown patties': 'frozen hash brown patties',
    'garlic bread': 'frozen garlic bread',
    'fish sticks': 'frozen breaded fish sticks',
    'almonds': 'raw whole almonds',
    'walnuts': 'halves & pieces walnuts',
    'roasted peanuts': 'dry roasted peanuts',
    'peanuts': 'dry roasted peanuts',
    'graham crackers': 'honey graham crackers',
    'mac & cheese cup': 'instant mac & cheese cup',
    'ramen noodles': 'instant ramen noodles',
    'ramen': 'instant ramen noodles',
    'gummy bears': 'gummy bear candy',
    'jelly beans': 'jelly bean candy',
    'chocolate bar': 'milk chocolate candy bar',
    'cranberry juice': 'cranberry juice cocktail',
    'seltzer water': 'flavored seltzer water',
    'seltzer': 'flavored seltzer water',
    'ginger ale': 'ginger ale soda',
    'espresso pods': 'decaf espresso pods',
    'hot cocoa mix': 'hot cocoa mix envelopes',
    'chocolate chips': 'semi-sweet chocolate chips',
    'marshmallows': 'mini marshmallows',
    'panko': 'panko breadcrumbs',
    'cornmeal': 'yellow cornmeal',
    'yeast': 'active dry yeast',
    'sesame oil': 'pure sesame oil',
    'fish sauce': 'premium fish sauce',
    'rolled barley': 'traditional rolled barley',
    'barley': 'traditional rolled barley',
    'green chilies': 'diced green chilies',
    'enchilada sauce': 'red enchilada sauce',
    'ranch': 'ranch dressing',
    'caesar dressing': 'creamy caesar dressing',
    'sweet and sour sauce': 'sweet & sour sauce',
    'pickle spears': 'kosher dill pickle spears',
    'pickles': 'kosher dill pickle spears',
    'relish': 'sweet relish',
    'black olives': 'pitted black olives',
    'green olives': 'green olives (stuffed)',
    'capers': 'capers (in brine)',
    'pesto sauce': 'basil pesto sauce',
    'pesto': 'basil pesto sauce',
    'alfredo sauce': 'creamy alfredo sauce',
    'alfredo': 'creamy alfredo sauce',
    'blue cheese': 'blue cheese crumbles',
    'fresh mozzarella': 'fresh mozzarella ball',
    'brie': 'brie cheese wheel',
    'string cheese': 'low-moisture string cheese',
    'sharp cheddar': 'sharp cheddar block',
    'American cheese': 'deli American cheese',
    'hummus': 'classic hummus',
    'pimento cheese': 'pimento cheese spread',
    'smoked ham': 'smoked ham slices',
    'potato salad': 'southern style potato salad',
    'cole slaw': 'creamy cole slaw',
    'coleslaw': 'creamy cole slaw',
    'frozen lasagna': 'frozen family size lasagna',
    'lasagna': 'frozen family size lasagna',
    'chicken pot pie': 'frozen chicken pot pie',
    'pot pie': 'frozen chicken pot pie',
    'garlic breadsticks': 'frozen garlic breadsticks',
    'mozzarella sticks': 'frozen mozzarella sticks',
    'tater tots': 'frozen tater tots',
    'onion rings': 'frozen battered onion rings',
    'sweet potato fries': 'frozen sweet potato fries',
    'chopped spinach': 'frozen chopped spinach',
    'breakfast hashbrowns': 'frozen breakfast hashbrowns',
    'hashbrowns': 'frozen breakfast hashbrowns',
    'blueberry waffles': 'frozen blueberry waffles',
    'waffles': 'frozen blueberry waffles',
    'breakfast burritos': 'frozen breakfast burritos',
    'ice cream bars': 'ice cream bars (chocolate coated)',
    'smoothie mix': 'frozen triple berry smoothie mix',
    'rainbow sherbet': 'frozen rainbow sherbet',
    'sherbet': 'frozen rainbow sherbet',
    'sparkling water': 'premium sparkling water',
    'energy drink': 'sugar-free energy drink',
    'sports drink': 'electrolyte sports drink',
    'diet cola': 'diet cola soda',
    'root beer': 'old fashioned root beer',
    'sweetened iced tea': 'chilled sweetened iced tea',
    'iced tea': 'chilled sweetened iced tea',
    'cold brew coffee': 'unsweetened cold brew coffee',
    'cold brew': 'unsweetened cold brew coffee',
    'coffee pods': 'single-serve coffee pods',
    'coffee beans': 'whole coffee beans',
    'green tea': 'pure green tea',
    'lemonade': 'lemonade bottle',
    'grapefruit juice': '100% grapefruit juice',
    'coconut water': 'pure coconut water',
    'paper towels': 'double-roll paper towels',
    'bath tissue': 'ultra soft bath tissue',
    'toilet paper': 'ultra soft bath tissue',
    'tissues': 'facial tissues',
    'trash bags': '13-gallon drawstring trash bags',
    'dish soap': 'ultra liquid dish soap',
    'dishwasher detergent': 'dishwasher detergent actionpacs',
    'laundry detergent': 'liquid laundry detergent (original)',
    'fabric softener': 'fabric softener sheets',
    'toilet bowl cleaner': 'clinging bleach toilet bowl gel',
    'multi-surface cleaner': 'multi-surface cleaner spray',
    'aluminum foil': 'standard aluminum foil',
    'foil': 'standard aluminum foil',
    'plastic wrap': 'plastic food wrap',
    'sandwich bags': 'zipper sandwich bags',
    'freezer bags': 'zipper freezer bags (gallon)',
    'honey nut cheerios': 'honey nut toasted oats cereal',
    'frosted flakes': 'frosted flakes cereal',
    'oatmeal packets': 'maple brown sugar oatmeal packets',
    'pancake mix': 'complete pancake & waffle mix',
    'pop-tarts': 'frosted strawberry pop-tarts',
    'grits': 'instant grits',
    'corn tortillas': 'yellow corn tortillas',
    'wheat crackers': 'original wheat crackers',
  };

  // Flat map preserving the original lookup surface (this.defaultPrices[key]);
  // built once from the canonical + alias maps above.
  private defaultPrices: Record<string, { price: number; unit: string }> = (() => {
    const merged: Record<string, { price: number; unit: string }> = { ...GroceryPriceService.CANONICAL_PRICES };
    for (const [alias, canonical] of Object.entries(GroceryPriceService.PRICE_ALIASES)) {
      merged[alias] = GroceryPriceService.CANONICAL_PRICES[canonical];
    }
    return merged;
  })();

  // Get current price data for an ingredient
  async getIngredientPrice(ingredient: string, location?: string): Promise<PriceData | null> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);

      // We'll prefer fresh data from Firestore or external APIs first;
      // consult the cache only after attempting DB/API fallbacks to avoid stale cross-test state.

      // Source 1: Query for recent user-submitted prices (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.COLLECTION_NAME),
        DatabaseMonitoringService.where('ingredient', '==', ingredientKey),
        DatabaseMonitoringService.where('lastUpdated', '>=', thirtyDaysAgo),
        DatabaseMonitoringService.orderBy('lastUpdated', 'desc'),
        DatabaseMonitoringService.limit(50)
      );

      const querySnapshot = await DatabaseMonitoringService.getDocs(q);

      const prices: number[] = [];

      querySnapshot.forEach((doc: { data(): GroceryPrice }) => {
        const data = doc.data();
        prices.push(data.price);
      });

      if (prices.length > 0) {
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceData = {
          averagePrice,
          minPrice,
          maxPrice,
          sampleSize: prices.length,
          lastUpdated: new Date(),
          unit: 'lb' // Default unit, could be improved
        };
        log.debug(`Using user-submitted price data for ${ingredient}: $${averagePrice.toFixed(2)}`, {}, 'GroceryPriceService');
        if (process.env.NODE_ENV !== 'test') {
          priceCacheService.setPriceData(ingredientKey, priceData);
        }
        return priceData;
      }

      // Source 2: Try Open Prices API
      try {
        const openPrices = await this.fetchOpenPrices(ingredient, location);
        const openPriceData = this.convertOpenPricesToPriceData(openPrices);
        if (openPriceData) {
          log.debug(`Using Open Prices API data for ${ingredient}`, { openPriceData }, 'GroceryPriceService');
          if (process.env.NODE_ENV !== 'test') {
            priceCacheService.setPriceData(ingredientKey, openPriceData);
          }
          return openPriceData;
        }
      } catch (err: unknown) {
        log.warn('Open Prices API fallback failed:', { err }, 'GroceryPriceService');
      }

      // Check cache as a final attempt before returning defaults
      const cachedData = priceCacheService.getPriceData(ingredientKey);
      if (cachedData) {
        return cachedData;
      }

      // Source 3: Use curated default prices as final fallback
      const defaultPrice = this.defaultPrices[ingredientKey];
      if (defaultPrice) {
        const priceData = {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
        log.debug(`Using default price for ${ingredient}: $${defaultPrice.price.toFixed(2)}`, {}, 'GroceryPriceService');
        priceCacheService.setPriceData(ingredientKey, priceData);
        return priceData;
      }

      // If nothing found, return null and let component handle it
      log.warn(`No price data found for ${ingredient} from any source`, {}, 'GroceryPriceService');
      return null;
    } catch (err: unknown) {
      log.error('Error fetching ingredient price:', { err }, 'GroceryPriceService');
      // Try to at least return default price on error
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const defaultPrice = this.defaultPrices[ingredientKey];
      if (defaultPrice) {
        const priceData = {
          averagePrice: defaultPrice.price,
          minPrice: defaultPrice.price,
          maxPrice: defaultPrice.price,
          sampleSize: 1,
          lastUpdated: new Date(),
          unit: defaultPrice.unit
        };
        log.debug(`Using default price (error fallback) for ${ingredient}: $${defaultPrice.price.toFixed(2)}`, {}, 'GroceryPriceService');
        priceCacheService.setPriceData(ingredientKey, priceData);
        return priceData;
      }
      return null;
    }
  }

  // Submit a price update from user
  async submitPriceUpdate(
    ingredient: string,
    price: number,
    unit: string,
    userId: string,
    store?: string,
    location?: string
  ): Promise<void> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const priceId = `${ingredientKey}_${userId}_${Date.now()}`;

      const priceData: GroceryPrice = {
        id: priceId,
        ingredient: ingredientKey,
        price,
        unit,
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'user',
        userId,
        votes: 1
      };

      if (store) {
        priceData.store = store;
      }
      if (location) {
        priceData.location = location;
      }

      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceId), priceData);

      // Also store in price history
      await this.storePriceHistory(priceData);
    } catch (err: unknown) {
      log.error('Error submitting price update:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  // Get price trends for an ingredient (combines user data + Open Prices API)
  async getPriceTrends(ingredient: string, days: number = 90, location?: string): Promise<GroceryPrice[]> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);

      // First try to get user-submitted historical data
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let querySnapshot: Awaited<ReturnType<typeof DatabaseMonitoringService.getDocs>>;

      try {
        const q = DatabaseMonitoringService.query(
          DatabaseMonitoringService.collection(this.PRICE_HISTORY_COLLECTION),
          DatabaseMonitoringService.where('ingredient', '==', ingredientKey),
          DatabaseMonitoringService.where('lastUpdated', '>=', startDate),
          DatabaseMonitoringService.orderBy('lastUpdated', 'desc')
        );
        querySnapshot = await DatabaseMonitoringService.getDocs(q);
      } catch {
        // Fallback to Firestore directly if monitoring wrapper unavailable
        const collectionRef = firestoreCollection(db, this.PRICE_HISTORY_COLLECTION);
        const q = firestoreQuery(
          collectionRef,
          firestoreWhere('ingredient', '==', ingredientKey),
          firestoreWhere('lastUpdated', '>=', startDate),
          firestoreOrderBy('lastUpdated', 'desc')
        );
        querySnapshot = await (await import('firebase/firestore')).getDocs(q);
      }

      const userTrends: GroceryPrice[] = [];

      querySnapshot.forEach((doc: { data(): GroceryPrice }) => {
        userTrends.push(doc.data());
      });

      // If we have enough user data, return it
      if (userTrends.length >= 5) {
        return userTrends;
      }

      // If there is some user data but not enough, supplement with Open Prices API data
      if (userTrends.length > 0) {
        log.debug(`Limited user trend data for ${ingredient} (${userTrends.length} points), fetching from Open Prices API...`, {}, 'GroceryPriceService');
        const apiTrends = await this.getPriceTrendsFromAPI(ingredient, days, location);

        // Combine and deduplicate (prefer user data over API data for same time periods)
        const combinedTrends = [...userTrends];

        // Add API data points that don't conflict with recent user data
        const recentUserDates = new Set(
          userTrends
            .filter(trend => trend.source === 'user')
            .map(trend => trend.lastUpdated.toDateString())
        );

        apiTrends.forEach(apiTrend => {
          if (!recentUserDates.has(apiTrend.lastUpdated.toDateString())) {
            combinedTrends.push(apiTrend);
          }
        });

        return combinedTrends.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
      }

      // No user data available and we don't call API for completely empty user data
      return [];
    } catch (err: unknown) {
      log.error('Error fetching price trends:', { err }, 'GroceryPriceService');

      // Fallback to Open Prices API only
      try {
        return await this.getPriceTrendsFromAPI(ingredient, days, location);
      } catch (fallbackError) {
        log.error('Fallback to Open Prices API also failed:', { fallbackError }, 'GroceryPriceService');
        return [];
      }
    }
  }

  // Get analyzed price trend data for UI display
  async getPriceTrendAnalysis(ingredient: string, days: number = 90, location?: string): Promise<PriceTrend | null> {
    try {
      const trends = await this.getPriceTrends(ingredient, days, location);

      if (trends.length === 0) {
        // Return default price if no data available
        const defaultPrice = this.getDefaultPrice(ingredient);
        return {
          currentPrice: defaultPrice.price,
          lastUpdated: new Date(),
          priceChange: 0,
          priceChangePercent: 0,
          priceHistory: []
        };
      }

      // Sort by date (most recent first)
      const sortedTrends = trends.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

      // Current price is the most recent
      const currentPrice = sortedTrends[0]!.price;
      const lastUpdated = sortedTrends[0]!.lastUpdated;

      // Calculate price change from the oldest available data point
      let priceChange = 0;
      let priceChangePercent = 0;

      if (sortedTrends.length > 1) {
        // Get the oldest price point available
        const oldestPrice = sortedTrends[sortedTrends.length - 1]!.price;
        priceChange = currentPrice - oldestPrice;
        priceChangePercent = (priceChange / oldestPrice) * 100;
      }

      // Build price history (last 10 entries)
      const priceHistory = sortedTrends.slice(0, 10).map(trend => ({
        date: trend.lastUpdated,
        price: trend.price
      }));

      return {
        currentPrice,
        lastUpdated,
        priceChange,
        priceChangePercent,
        priceHistory
      };
    } catch (err: unknown) {
      log.error('Error analyzing price trends:', { err }, 'GroceryPriceService');

      // Return default price on error
      const defaultPrice = this.getDefaultPrice(ingredient);
      return {
        currentPrice: defaultPrice.price,
        lastUpdated: new Date(),
        priceChange: 0,
        priceChangePercent: 0,
        priceHistory: []
      };
    }
  }

  // Get default price for an ingredient with plural fallback
  private getDefaultPrice(ingredient: string): { price: number; unit: string } {
    const key = this.normalizeIngredientName(ingredient);
    if (this.defaultPrices[key]) return this.defaultPrices[key];

    // Plural fallback: strip trailing 'es' or 's'
    if (key.endsWith('es') && this.defaultPrices[key.slice(0, -2)]) {
      return this.defaultPrices[key.slice(0, -2)];
    }
    if (key.endsWith('s') && this.defaultPrices[key.slice(0, -1)]) {
      return this.defaultPrices[key.slice(0, -1)];
    }

    return { price: 2.99, unit: 'unit' };
  }

  // Fetch latest prices from external APIs (placeholder for future implementation)
  async fetchLatestPrices(): Promise<void> {
    // This would integrate with APIs like:
    // - USDA FoodData Central
    // - Walmart API
    // - Kroger API
    // - Instacart API
    // For now, we'll rely on user-submitted data
    log.info('Fetching latest prices from external APIs...', {}, 'GroceryPriceService');
  }

  // Vote on price accuracy
  async voteOnPrice(priceId: string, userId: string, vote: 'up' | 'down'): Promise<void> {
    try {
      const priceRef = DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceId);
      const priceDoc = await DatabaseMonitoringService.getDoc(priceRef);

      if (!priceDoc.exists()) {
        throw new Error('Price not found');
      }

      const currentVotes = priceDoc.data().votes || 0;
      const newVotes = vote === 'up' ? currentVotes + 1 : Math.max(0, currentVotes - 1);

      await DatabaseMonitoringService.updateDoc(priceRef, { votes: newVotes });
    } catch (err: unknown) {
      log.error('Error voting on price:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  // Store price in history collection
  private async storePriceHistory(priceData: GroceryPrice): Promise<void> {
    try {
      const historyId = `${priceData.id}_history`;
      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.PRICE_HISTORY_COLLECTION, historyId), {
        ...priceData,
        recordedAt: new Date()
      });
    } catch (err: unknown) {
      log.error('Error storing price history:', { err }, 'GroceryPriceService');
    }
  }

  // Get all available ingredients with price data
  async getAvailableIngredients(): Promise<string[]> {
    try {
      // Option 1: Use direct Firestore (current)
      // const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));

      // Option 2: Use DatabaseMonitoringService for tracking (recommended for analytics)
      const ingredientsRef = DatabaseMonitoringService.collection(this.COLLECTION_NAME);
      const querySnapshot = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.query(ingredientsRef));

      const ingredients = new Set<string>();

      querySnapshot.forEach((doc: { data(): GroceryPrice }) => {
        const data = doc.data();
        ingredients.add(data.ingredient);
      });

      // Add default ingredients
      Object.keys(this.defaultPrices).forEach(ingredient => {
        ingredients.add(ingredient);
      });

      return Array.from(ingredients).sort();
    } catch (err: unknown) {
      log.error('Error fetching available ingredients:', { err }, 'GroceryPriceService');
      return Object.keys(this.defaultPrices);
    }
  }

  // ===== OPEN PRICES API INTEGRATION =====

  private readonly OPEN_PRICES_BASE_URL = 'https://prices.openfoodfacts.org/api/v1';

  /**
   * Fetch historical prices from Open Prices API for trend analysis
   */
  private async fetchOpenPricesHistory(ingredient: string, days: number = 90, _location?: string): Promise<OpenPricesPrice[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      const params = new URLSearchParams();
      params.append('product_name__like', ingredient);
      params.append('date__gte', startDateStr);
      params.append('currency', 'USD');
      params.append('limit', '100');

      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/v1/prices?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Open Prices API error: ${response.status}`);
      }

      const data: OpenPricesResponse = await response.json();
      return data.items || [];
    } catch (err: unknown) {
      log.warn('Failed to fetch historical prices from Open Prices API:', { err }, 'GroceryPriceService');
      return [];
    }
  }

  /**
   * Get price trends using Open Prices API data
   */
  async getPriceTrendsFromAPI(ingredient: string, days: number = 90, location?: string): Promise<GroceryPrice[]> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const historicalPrices = await this.fetchOpenPricesHistory(ingredient, days, location);

      if (historicalPrices.length === 0) {
        return [];
      }

      // Convert Open Prices data to our GroceryPrice format
      const trends: GroceryPrice[] = historicalPrices
        .filter(price => price.currency === 'USD')
        .map(price => ({
          id: `openprices_${price.id}`,
          ingredient: ingredientKey,
          price: price.price,
          unit: 'each', // Open Prices doesn't specify units
          store: price.store || 'Unknown Store',
          location: price.location || location || 'Unknown Location',
          currency: price.currency,
          lastUpdated: new Date(price.date),
          source: 'api' as const,
          userId: undefined,
          votes: undefined
        }))
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()); // Most recent first

      return trends;
    } catch (err: unknown) {
      log.error('Error fetching price trends from Open Prices API:', { err }, 'GroceryPriceService');
      return [];
    }
  }

  /**
   * Store Open Prices data periodically for trend analysis
   */
  async storeOpenPricesSnapshot(ingredient: string, location?: string): Promise<void> {
    try {
      const ingredientKey = this.normalizeIngredientName(ingredient);
      const currentPrices = await this.fetchOpenPrices(ingredient, location);

      if (currentPrices.length === 0) return;

      // Store current snapshot in history
      const snapshotId = `openprices_${ingredientKey}_${Date.now()}`;

      // Store aggregated data point
      const usdPrices = currentPrices
        .filter(p => p.currency === 'USD')
        .map(p => p.price);

      if (usdPrices.length === 0) return;

      const averagePrice = usdPrices.reduce((sum, price) => sum + price, 0) / usdPrices.length;

      const snapshotData: GroceryPrice = {
        id: snapshotId,
        ingredient: ingredientKey,
        price: Math.round(averagePrice * 100) / 100, // Round to 2 decimals
        unit: 'each',
        store: 'Open Prices API',
        location: location || 'Global Average',
        currency: 'USD',
        lastUpdated: new Date(),
        source: 'api',
        userId: undefined,
        votes: usdPrices.length // Use sample size as "votes"
      };

      await DatabaseMonitoringService.setDoc(DatabaseMonitoringService.doc(this.PRICE_HISTORY_COLLECTION, snapshotId), {
        ...snapshotData,
        recordedAt: new Date()
      });

      log.debug(`Stored Open Prices snapshot for ${ingredient}: $${averagePrice.toFixed(2)}`, {}, 'GroceryPriceService');
    } catch (err: unknown) {
      log.warn('Failed to store Open Prices snapshot:', { err }, 'GroceryPriceService');
    }
  }

  /**
   * Convert Open Prices data to our PriceData format
   */
  private convertOpenPricesToPriceData(prices: OpenPricesPrice[] | null): PriceData | null {
    if (!prices || prices.length === 0) return null;

    // Filter to USD prices only and convert to numbers
    const usdPrices = prices
      .filter(p => p.currency === 'USD' && typeof p.price === 'number')
      .map(p => p.price);

    if (usdPrices.length === 0) return null;

    const averagePrice = usdPrices.reduce((sum, price) => sum + price, 0) / usdPrices.length;
    const minPrice = Math.min(...usdPrices);
    const maxPrice = Math.max(...usdPrices);

    // Get the most recent date from the prices
    const latestDate = prices
      .map(p => new Date(p.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      averagePrice: Math.round(averagePrice * 100) / 100, // Round to 2 decimal places
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      sampleSize: usdPrices.length,
      lastUpdated: latestDate || new Date(),
      unit: 'each' // Open Prices doesn't specify units, default to each
    };
  }

  /**
   * Update price trends for popular ingredients using Open Prices API
   * Call this periodically (e.g., daily) to build trend data
   */
  async updatePriceTrendsFromAPI(popularIngredients: string[] = [], location?: string): Promise<void> {
    try {
      const ingredientsToUpdate = popularIngredients.length > 0
        ? popularIngredients
        : ['banana', 'apple', 'milk', 'bread', 'chicken', 'eggs', 'cheese', 'tomato', 'lettuce', 'potato'];

      log.info(`Updating price trends for ${ingredientsToUpdate.length} ingredients from Open Prices API...`, {}, 'GroceryPriceService');

      for (const ingredient of ingredientsToUpdate) {
        await this.storeOpenPricesSnapshot(ingredient, location);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      log.info('Price trend update completed', {}, 'GroceryPriceService');
    } catch (err: unknown) {
      log.error('Error updating price trends from API:', { err }, 'GroceryPriceService');
    }
  }

  /**
   * Submit a price to Open Prices (for users who want to contribute)
   */
  async submitToOpenPrices(priceData: {
    product_name: string;
    price: number;
    currency: string;
    location?: string;
    store?: string;
    date?: string;
  }): Promise<boolean> {
    try {
      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        },
        body: JSON.stringify({
          ...priceData,
          date: priceData.date || new Date().toISOString().split('T')[0]
        })
      });

      return response.ok;
    } catch (err: unknown) {
      log.warn('Failed to submit price to Open Prices:', { err }, 'GroceryPriceService');
      return false;
    }
  }

  private async fetchOpenPrices(ingredient: string, location?: string): Promise<OpenPricesPrice[]> {
    try {
      // Get recent prices (last 30 days) for current price estimation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateStr = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

      const params = new URLSearchParams();
      params.append('product_name', ingredient);
      params.append('date__gte', startDateStr);
      params.append('currency', 'USD');
      params.append('limit', '50');
      params.append('order_by', '-date');

      if (location) {
        params.append('location__like', location);
      }

      const response = await fetch(`${this.OPEN_PRICES_BASE_URL}/prices?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SmartPantry/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Open Prices API error: ${response.status}`);
      }

      const data: OpenPricesResponse = await response.json();
      return data.items || [];
    } catch (err: unknown) {
      log.warn(`Failed to fetch current prices from Open Prices API for ${ingredient}:`, { err }, 'GroceryPriceService');
      return [];
    }
  }

  async saveGroceryPrice(priceData: GroceryPrice): Promise<void> {
    try {
      const priceRef = DatabaseMonitoringService.doc(this.COLLECTION_NAME, priceData.id);
      await DatabaseMonitoringService.setDoc(priceRef, {
        ...priceData,
        lastUpdated: new Date()
      });
    } catch (err: unknown) {
      log.error('Error saving grocery price:', { err }, 'GroceryPriceService');
      throw err;
    }
  }

  calculatePriceStats(prices: number[]): PriceData | null {
    if (prices.length === 0) {
      return null;
    }

    const sum = prices.reduce((acc, price) => acc + price, 0);
    const averagePrice = sum / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return {
      averagePrice,
      minPrice,
      maxPrice,
      sampleSize: prices.length,
      lastUpdated: new Date(),
      unit: 'lb' // Default unit
    };
  }

  normalizeIngredientName(name: string): string {
    return name.toLowerCase().trim();
  }
}

export const groceryPriceService = new GroceryPriceService();
