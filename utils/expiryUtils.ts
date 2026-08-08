import remoteConfig from '../services/remoteConfigService';
import { PantryItem } from '../types';

export function inferStorageLocationFromItemName(itemName: string): 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other' {
  const item = itemName.toLowerCase();

  // Frozen items (check first)
  if (item.includes('frozen') || item.includes('ice cream') || item.includes('pizza') ||
      item.includes('waffles') || item.includes('pancakes') || item.includes('frozen vegetable') ||
      item.includes('frozen fruit') || item.includes('frozen fish') || item.includes('frozen pizza') ||
      item.includes('frozen meal') || item.includes('frozen dinner') || item.includes('frozen breakfast') ||
      item.includes('frozen shrimp') || item.includes('frozen salmon') || item.includes('frozen tilapia') ||
      item.includes('frozen cod') || item.includes('frozen yogurt') || item.includes('sorbet') || item.includes('gelato')) {
    return 'freezer';
  }

  // Spices and herbs (check before pantry to avoid conflicts)
  if (item.includes('salt') || item.includes('pepper') || item.includes('onion powder') ||
      item.includes('spice') || item.includes('herb') || item.includes('cumin') || item.includes('paprika') ||
      (item.includes('oregano') && !item.includes('fresh oregano')) ||
      (item.includes('basil') && !item.includes('fresh basil')) ||
      (item.includes('thyme') && !item.includes('fresh thyme')) ||
      item.includes('rosemary') ||
      item.includes('cinnamon') || item.includes('nutmeg') || item.includes('curry') || item.includes('chili powder') ||
      item.includes('vanilla extract') || item.includes('baking powder') || item.includes('baking soda') ||
      item.includes('seasoning') || item.includes('rub') || item.includes('blend') || item.includes('mix') ||
      item.includes('italian seasoning') || item.includes('taco seasoning') || item.includes('yeast') ||
      item.includes('cornstarch') || item.includes('gelatin') || item.includes('almond extract') ||
      item.includes('peppermint extract')) {
    return 'spices';
  }

  // Other items (storage, cleaning, etc.) - check before pantry
  if (item.includes('ziploc') || item.includes('aluminum foil') || item.includes('saran wrap') ||
      item.includes('parchment paper') || item.includes('wax paper') || item.includes('plastic wrap') ||
      item.includes('storage bag') || item.includes('tupperware') || item.includes('butcher paper') ||
      item.includes('facial tissue') || item.includes('paper plate') || item.includes('bleach')) {
    return 'other';
  }

  // Fridge items (dairy, fresh produce, fresh meats, condiments)
  if (item.includes('milk') || item.includes('cheese') || item.includes('yogurt') ||
      (item.includes('butter') && !item.includes('peanut butter') && !item.includes('almond butter')) ||
      item.includes('egg') || item.includes('lettuce') || item.includes('spinach') || item.includes('carrot') ||
      item.includes('celery') || item.includes('strawberry') || item.includes('blueberry') || item.includes('cream') ||
      item.includes('sour cream') || item.includes('cottage cheese') || item.includes('hot sauce') ||
      item.includes('barbecue sauce') || item.includes('soy sauce') || item.includes('salad dressing') ||
      item.includes('lunch meat') || item.includes('cold cut') || item.includes('prosciutto') ||
      item.includes('fresh basil') || item.includes('fresh parsley') || item.includes('fresh fish') ||
      item.includes('fresh shrimp') || item.includes('sliced roast beef') || item.includes('sliced turkey') ||
      item.includes('sliced ham') || item.includes('sliced bologna') || item.includes('sliced salami')) {
    return 'fridge';
  }

  // Freezer items (frozen meats, frozen meals, ice cream)
  if (item.includes('chicken') || item.includes('beef') || item.includes('pork') || item.includes('fish') ||
      item.includes('salmon') || item.includes('bacon') || item.includes('sausage') || item.includes('ground turkey') ||
      item.includes('chicken breast') || item.includes('pork chop') || item.includes('lamb chop') ||
      item.includes('venison') || item.includes('frozen pizza') || item.includes('frozen meal') ||
      item.includes('frozen yogurt') || item.includes('sorbet') || item.includes('gelato') ||
      item.includes('frozen cod') || item.includes('ice cream')) {
    return 'freezer';
  }

  // Pantry items (dry goods, canned goods, etc.)
  if (item.includes('pasta') || item.includes('noodle') || item.includes('rice') || item.includes('cereal') ||
      item.includes('flour') || item.includes('sugar') || item.includes('bread') || item.includes('cracker') ||
      item.includes('cookie') || item.includes('chip') || item.includes('candy') || item.includes('peanut') ||
      item.includes('almond') || item.includes('nut') || item.includes('canned') || item.includes('can ') ||
      item.includes('soup') || item.includes('bean') || item.includes('tomato sauce') || item.includes('oil') ||
      item.includes('vinegar') || item.includes('honey') || item.includes('jam') || item.includes('peanut butter') ||
      item.includes('coffee') || item.includes('tea') || item.includes('oat') || item.includes('quinoa') ||
      item.includes('barley') || item.includes('pasta sauce') || item.includes('macaroni') || item.includes('lasagna') ||
      item.includes('spaghetti') || item.includes('ravioli') || item.includes('tortellini') || item.includes('ramen') ||
      item.includes('udon') || item.includes('soba') || item.includes('rice noodle') || item.includes('bread crumbs') ||
      item.includes('potato') ||
      item.includes('onion') || item.includes('garlic') || item.includes('sweet potato') || item.includes('apple') ||
      item.includes('orange') || item.includes('banana') || item.includes('avocado') || item.includes('lemon') ||
      item.includes('lime') || item.includes('tomato') || item.includes('bread') || item.includes('tortilla') ||
      item.includes('pita') || item.includes('bagel') || item.includes('syrup') || item.includes('maple syrup') ||
      item.includes('agave') || item.includes('almond butter') || item.includes('jelly') || item.includes('juice box') ||
      item.includes('powdered drink mix') || item.includes('pickle') || item.includes('olive') || item.includes('relish')) {
    return 'pantry';
  }

  // Default to pantry for anything else
  return 'pantry';
}

/**
 * Returns USDA-based freezer shelf-life in days for a given food item name.
 * Defaults to 120 days (4 months) for unrecognised items.
 */
export function getFreezerShelfLifeDays(itemName: string): number {
  const name = itemName.toLowerCase();

  // Ground / minced meat — highest turnover, 4 months
  if (name.includes('ground') || name.includes('hamburger') || name.includes('mince')) return 120;

  // Fatty fish — quality degrades faster, 3 months
  if (name.includes('salmon') || name.includes('tuna') || name.includes('mackerel') || name.includes('sardine')) return 90;

  // Shellfish / seafood, 4 months
  if (name.includes('shrimp') || name.includes('prawn') || name.includes('crab') ||
      name.includes('lobster') || name.includes('scallop') || name.includes('clam') ||
      name.includes('mussel') || name.includes('oyster')) return 120;

  // Lean fish, 6 months
  if (name.includes('fish') || name.includes('tilapia') || name.includes('cod') ||
      name.includes('halibut') || name.includes('flounder')) return 180;

  // Poultry (whole bird or parts), 9 months
  if (name.includes('chicken') || name.includes('turkey') || name.includes('duck')) return 270;

  // Pork, sausage, bacon, 6 months
  if (name.includes('pork') || name.includes('ham') || name.includes('bacon') ||
      name.includes('sausage')) return 180;

  // Beef steaks / roasts (ground already handled above), 9 months
  if (name.includes('beef') || name.includes('steak') || name.includes('roast') ||
      name.includes('brisket') || name.includes('rib')) return 270;

  // Lamb / veal, 9 months
  if (name.includes('lamb') || name.includes('veal')) return 270;

  // Deli / cured meats, 2 months
  if (name.includes('deli') || name.includes('cold cut') || name.includes('lunch meat') ||
      name.includes('bologna') || name.includes('salami') || name.includes('pepperoni')) return 60;

  // Bread and baked goods, 3 months
  if (name.includes('bread') || name.includes('roll') || name.includes('bun') ||
      name.includes('muffin') || name.includes('bagel') || name.includes('waffle') ||
      name.includes('pancake')) return 90;

  // Butter, 1 year
  if (name.includes('butter')) return 365;

  // Default for unrecognised items (casseroles, leftovers, etc.)
  return 120;
}

/**
 * Returns how many days an item typically lasts after being opened.
 * Based on USDA / FDA shelf-life guidance.
 * @param itemName Item name (used for name-based overrides within a category)
 * @param category The item's category string
 * @returns Number of days of opened shelf life, or undefined if unknown
 */
export function getOpenedShelfLifeDays(itemName: string, category: string): number | undefined {
  const name = itemName.toLowerCase();
  const cat = (category || '').toLowerCase();

  // Dairy
  if (cat.includes('dairy') || cat.includes('milk') || cat.includes('cheese')) {
    if (name.includes('hard cheese') || name.includes('parmesan') || name.includes('romano')) return 21;
    if (name.includes('soft cheese') || name.includes('brie') || name.includes('camembert') ||
        name.includes('ricotta') || name.includes('cottage')) return 7;
    if (name.includes('cream cheese') || name.includes('sour cream') || name.includes('creme fraiche')) return 14;
    if (name.includes('butter')) return 21;
    if (name.includes('yogurt')) return 7;
    if (name.includes('milk') || name.includes('cream')) return 5;
    return 7; // default dairy
  }

  // Deli / Meat
  if (cat.includes('deli') || cat.includes('meat') || cat.includes('poultry') || cat.includes('seafood')) {
    if (name.includes('deli') || name.includes('cold cut') || name.includes('lunch meat')) return 5;
    if (name.includes('bacon')) return 7;
    if (name.includes('sausage') && !name.includes('frozen')) return 4;
    return 3; // fresh meat / fish after opening / thawing
  }

  // Canned Goods
  if (cat.includes('canned') || cat.includes('can ')) {
    if (name.includes('fish') || name.includes('tuna') || name.includes('salmon') ||
        name.includes('sardine')) return 3; // canned fish refrigerated
    return 5; // other canned goods once opened
  }

  // Condiments & Sauces
  if (cat.includes('condiment') || cat.includes('sauce')) {
    if (name.includes('ketchup') || name.includes('mustard')) return 60;
    if (name.includes('mayonnaise') || name.includes('mayo')) return 60;
    if (name.includes('salad dressing') || name.includes('dressing')) return 60;
    if (name.includes('soy sauce')) return 180;
    if (name.includes('hot sauce')) return 180;
    if (name.includes('vinegar')) return 365;
    return 90; // default condiment
  }

  // Bread / Bakery
  if (cat.includes('bread') || cat.includes('bak')) {
    return 5;
  }

  // Nut Butters
  if (cat.includes('nut butter') || name.includes('peanut butter') || name.includes('almond butter') ||
      name.includes('cashew butter') || name.includes('tahini')) {
    return 90;
  }

  // Produce
  if (cat.includes('produce') || cat.includes('vegetable') || cat.includes('fruit')) {
    if (name.includes('leafy') || name.includes('lettuce') || name.includes('spinach') ||
        name.includes('arugula') || name.includes('kale')) return 3;
    if (name.includes('berry') || name.includes('berries')) return 3;
    return 5;
  }

  // Beverages
  if (cat.includes('beverage') || cat.includes('juice')) {
    return 7;
  }

  return undefined; // category unknown — don't set openedExpiry
}

/**
 * Determines if an item should have an automatic expiration date and returns the date
 * @param itemName The name of the item
 * @param category The category of the item
 * @param storageLocation Optional storage location — 'freezer' returns freezer shelf-life dates
 * @returns ISO date string (YYYY-MM-DD) for expiration, or undefined if no auto-expiration
 */
export function getAutoExpirationDate(itemName: string, category: string, storageLocation?: string): string | undefined {
  const name = itemName.toLowerCase();
  const cat = category.toLowerCase();

  // Frozen items: use USDA freezer shelf life instead of fridge durations
  if (storageLocation === 'freezer') {
    const days = getFreezerShelfLifeDays(itemName);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // Canned goods: default to 2 years (730 days) from today but optional
  if (cat === 'canned goods') {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 730);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Long-term storage items should not have expiration dates
  const longTermCategories = ['pasta & noodles', 'grains & bread', 'baking supplies', 'condiments & sauces', 'spices & herbs', 'snacks', 'beverages'];
  if (longTermCategories.includes(cat)) {
    return undefined;
  }

  // Dairy products
  if (name.includes('milk') || cat === 'dairy') {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 10);
    return expirationDate.toISOString().slice(0, 10); // YYYY-MM-DD format
  }

  // Yogurt (7-14 days depending on type)
  if (name.includes('yogurt') || name.includes('yoghurt')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 10);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Cheese (varies by type, but generally 7-21 days once opened)
  if (name.includes('cheese') && !name.includes('processed') && !name.includes('american')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Sour cream and similar dairy spreads
  if (name.includes('sour cream') || name.includes('cream cheese') || name.includes('cottage cheese')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 21);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Bakery items
  if (name.includes('bread') || cat === 'bakery') {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 3);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Pastries and baked goods
  if (name.includes('pastry') || name.includes('croissant') || name.includes('muffin') ||
      name.includes('danish') || name.includes('donut') || name.includes('doughnut')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 2);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Tortillas and flatbreads
  if (name.includes('tortilla') || name.includes('pita') || name.includes('naan')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Fresh meat and poultry
  if ((name.includes('chicken') || name.includes('turkey') || name.includes('duck') ||
       name.includes('beef') || name.includes('pork') || name.includes('lamb') ||
       name.includes('veal') || name.includes('fish') || name.includes('salmon') ||
       name.includes('tuna') || name.includes('shrimp')) &&
      !name.includes('canned') && !name.includes('soup') && cat !== 'canned') {
    const expirationDate = new Date();
    // Fresh meat: 3-5 days, fish: 2 days
    const days = name.includes('fish') || name.includes('shrimp') || name.includes('salmon') ? 2 : 4;
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Fresh produce - fruits
  if (name.includes('apple') || name.includes('orange') || name.includes('banana') ||
      name.includes('grape') || name.includes('strawberr') || name.includes('blueberr') ||
      name.includes('raspberr') || name.includes('blackberr') || name.includes('peach') ||
      name.includes('pear') || name.includes('plum') || name.includes('kiwi') ||
      name.includes('mango') || name.includes('pineapple') || name.includes('watermelon') ||
      name.includes('cantaloupe') || name.includes('honeydew')) {
    const expirationDate = new Date();
    // Most fruits: 5-7 days
    const days = name.includes('banana') ? 5 : 7;
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Fresh produce - vegetables
  if (name.includes('lettuce') || name.includes('spinach') || name.includes('kale') ||
      name.includes('broccoli') || name.includes('cauliflower') || name.includes('carrot') ||
      name.includes('celery') || name.includes('cucumber') || name.includes('tomato') ||
      name.includes('pepper') || name.includes('onion') || name.includes('garlic') ||
      name.includes('potato') || name.includes('cabbage') || name.includes('zucchini') ||
      name.includes('eggplant') || name.includes('mushroom')) {
    const expirationDate = new Date();
    // Leafy greens: 3-5 days, root vegetables: carrots (30 days), potatoes (60 days), onions (90 days), garlic (180 days)
    const days = (name.includes('lettuce') || name.includes('spinach') || name.includes('kale')) ? 4 :
                 name.includes('garlic') ? 180 :
                 name.includes('onion') ? 90 :
                 name.includes('potato') ? 60 :
                 name.includes('carrot') ? 30 : 7;
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Eggs
  if (name.includes('egg')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 21);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Fresh herbs
  if (name.includes('basil') || name.includes('cilantro') || name.includes('parsley') ||
      name.includes('mint') || name.includes('dill') || name.includes('chives') ||
      name.includes('rosemary') || name.includes('thyme') || name.includes('oregano') ||
      name.includes('sage')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    return expirationDate.toISOString().slice(0, 10);
  }

  // Deli meats and prepared foods
  if (name.includes('deli') || name.includes('cold cut') || name.includes('lunch meat') ||
      name.includes('bologna') || name.includes('salami') || name.includes('pepperoni')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 5);
    return expirationDate.toISOString().slice(0, 10);
  }

  return undefined;
}

/**
 * Determines whether an expiry alert should be shown for an item
 * @param item The pantry item
 * @returns True if an alert should be shown
 */
export function shouldShowExpiryAlert(item: PantryItem): boolean {
  // Never show expiry alerts for immortal items
  if (item.is_immortal) return false;

  const isFrozen = item.is_frozen || item.storageLocation === 'freezer';

  // Frozen items: use freezerExpiry if available; only alert within RC-configured window
  if (isFrozen) {
    const dateStr = item.freezerExpiry || item.expirationDate;
    if (!dateStr || item.expiryAlertShown) return false;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= remoteConfig.getNumber('expiry_frozen_alert_days');
  }

  if (!item.expirationDate || item.expiryAlertShown) {
    return false;
  }
  const expirationDate = new Date(item.expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const isMilk = item.item.toLowerCase().includes('milk') || item.category.toLowerCase() === 'dairy';
  const warningThreshold = isMilk ? 3 : 7;

  return daysRemaining <= warningThreshold;
}

/**
 * Gets visual indicator color for expiration status
 * @param daysRemaining Days until expiration
 * @param expirationType Type of expiration date
 * @returns Color class name
 */

export function getExpirationColor(daysOrDate: number | string, _expirationType: 'use-by' | 'best-by' = 'best-by'): string {
  // Accept either a precomputed daysRemaining number or an ISO date string.
  let daysRemaining: number;
  if (typeof daysOrDate === 'number') {
    daysRemaining = daysOrDate;
  } else {
    const date = new Date(daysOrDate);
    if (isNaN(date.getTime())) {
      // If invalid date, treat as distant future
      daysRemaining = 3650;
    } else {
      daysRemaining = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
  }

  if (daysRemaining < 0) return 'text-red-600 bg-red-50 border-red-200'; // Expired
  if (daysRemaining === 0) return 'text-red-600 bg-red-50 border-red-200'; // Expires today
  if (daysRemaining <= remoteConfig.getNumber('expiry_critical_days')) return 'text-red-600 bg-red-50 border-red-200'; // Critical
  if (daysRemaining <= remoteConfig.getNumber('expiry_warning_days')) return 'text-orange-600 bg-orange-50 border-orange-200'; // Warning
  if (daysRemaining <= remoteConfig.getNumber('expiry_info_days')) return 'text-yellow-600 bg-yellow-50 border-yellow-200'; // Info
  return 'text-green-600 bg-green-50 border-green-200'; // Good
}
