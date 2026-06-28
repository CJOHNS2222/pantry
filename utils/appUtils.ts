import { Timestamp, serverTimestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { DayPlan, User, Household } from '../types';
import { Capacitor } from '@capacitor/core';
import { UsageService } from '../services/usageService';
import remoteConfig from '../services/remoteConfigService';
import { ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, PantryItem, CustomCategory, Member } from '../types';
import { getQuantityAmount, getQuantityUnit } from './quantityUtils';
import { convertToMetric, convertToStandard } from './measurementUtils';
import { getPerformance, trace } from "firebase/performance";
import { itemImages, ITEM_IMAGE_CDN_BASE } from '../data/item-images';

const performance = getPerformance();

function normalizeItemImageLookupName(itemName: string): string {
  return itemName.toLowerCase().trim()
    .replace(/^\d+\s+/, '')
    .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
    .replace(/\b(red|green|yellow|blue|black|white|brown|orange|purple|pink)\s+/g, '')
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '')
    .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '')
    .trim();
}

function resolveSeededItemImageFilename(itemName: string): string | undefined {
  const name = itemName.toLowerCase().trim();
  const cleanedName = normalizeItemImageLookupName(itemName);

  if (itemImages[cleanedName]) return itemImages[cleanedName];
  if (itemImages[name]) return itemImages[name];

  let bestKey = '';
  for (const key of Object.keys(itemImages)) {
    if ((cleanedName.includes(key) || name.includes(key)) && key.length > bestKey.length) {
      bestKey = key;
    }
  }

  return bestKey ? itemImages[bestKey] : undefined;
}

export async function saveDayPlan(householdId: string, day: DayPlan) {
  const id = day.date; // 'YYYY-MM-DD'
  const ref = DatabaseMonitoringService.doc(`households/${householdId}/mealPlan`, id);
  await DatabaseMonitoringService.setDoc(ref, {
    date: Timestamp.fromDate(new Date(day.date)),
    breakfast: day.breakfast || [],
    lunch: day.lunch || [],
    dinner: day.dinner || [],
    lastModifiedBy: localStorage.getItem('clientId') || null,
    lastModifiedAt: serverTimestamp()
  });
}

/**
 * Generates an array of the next 7 date keys in YYYY-MM-DD format
 * @param start The starting date (defaults to today)
 * @returns Array of 7 date strings
 */
export function next7DateKeys(start = new Date()) {
  const keys: string[] = [];
  const d = new Date(start);
  d.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const k = d.toISOString().slice(0,10); // 'YYYY-MM-DD'
    keys.push(k);
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

/**
 * Checks if a user is a member of a household
 * @param h The household object
 * @param u The user object
 * @returns True if the user is a member of the household
 */
export function isHouseholdMember(h: Household | null | undefined, u: User | null | undefined) {
  if (!h || !u) return false;
  // Prefer the members array — it carries status, so we can exclude pending invites.
  // Treat a missing status as 'active' for backward-compat with legacy data.
  if (Array.isArray(h.members) && h.members.length > 0) {
    return h.members.some(
      (m: Member) =>
        ((m.id && m.id === u.id) || (m.email && m.email === u.email)) &&
        (m.status === 'active' || !m.status)
    );
  }
  // Fallback: legacy households that only have memberIds (no members array).
  return Array.isArray(h.memberIds) && h.memberIds.includes(u.id);
}

/**
 * Parses item text to extract quantity and cleaned description
 * @param itemText Raw item text (e.g., "1 red apple", "2 large eggs")
 * @returns Object with quantity and cleaned description
 */
export function parseItemText(itemText: string): { quantity: number; description: string } {
  const text = itemText.trim();
  
  // Extract quantity from the beginning (e.g., "1 ", "2 ", "3 ", etc.)
  const quantityMatch = text.match(/^(\d+)\s+/);
  const quantity = quantityMatch ? Math.max(1, parseInt(quantityMatch[1]!, 10)) : 1;
  
  // Clean the description by removing quantities and common descriptors
  let description = text
    // Remove quantities at the beginning
    .replace(/^\d+\s+/, '')
    // Remove leading store-brand abbreviations (CV = Clover Valley, GV = Great Value)
    .replace(/^(CV|GV)\s+/i, '')
    // Remove common size descriptors
    .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
    // Keep colors for distinguishing items (like red vs green apples)
    // .replace(/\b(red|green|yellow|blue|black|white|brown|orange|purple|pink)\s+/g, '')
    // Remove common preparation connectors
    .replace(/\b(cut into|sliced into|torn into|chopped into|finely chopped into)\b/gi, '')
    // Remove common preparation descriptors that don't affect core item identity
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely|halved|seeded|shredded|julienned|torn|plucked|to serve|for serving|strips)\b/gi, '')
    // Remove common quality descriptors
    .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '');

  // Remove dangling conjunctions/prepositions at the end of the item name or before commas
  description = description.replace(/\s*\b(and|or|with|for|to|into)\b\s*(,|$)/gi, '$2');

  // Clean up trailing/leading whitespace and stray commas
  description = description.replace(/,\s*$/, '').replace(/\s+,\s+/g, ' ').replace(/^,\s*/, '').trim();
  description = description.replace(/\s+/g, ' ');
  
  // Capitalize first letter of each word for better display
  description = description.replace(/\b\w/g, l => l.toUpperCase());
  
  return { quantity, description };
}

/**
 * Parses ingredient text to extract quantity string and item name for shopping list
 * @param ingredientText Raw ingredient text (e.g., "1 cup flour", "2 tbsp sugar", "3 eggs")
 * @returns Object with quantity string and cleaned item name
 */
export function parseIngredientForShoppingList(ingredientText: string): { quantity: string; itemName: string; prepNotes?: string } {
  const perfTrace = trace(performance, 'parse_ingredient_shopping_list');
  perfTrace.start();

  try {
    // ── Pre-processing ──────────────────────────────────────────────────────
    // 1) Normalise Unicode vulgar fractions so the rest of the parser only
    //    ever sees ASCII digit sequences.
    let text = ingredientText.trim()
      .replace(/½/g, '1/2')
      .replace(/¼/g, '1/4')
      .replace(/¾/g, '3/4')
      .replace(/⅓/g, '1/3')
      .replace(/⅔/g, '2/3')
      .replace(/⅛/g, '1/8')
      .replace(/⅜/g, '3/8')
      .replace(/⅝/g, '5/8')
      .replace(/⅞/g, '7/8');

    // 2) Handle mixed fractions written as two separate tokens, e.g. "1 1/2 tsp"
    //    Collapse them into a single token like "1.5 tsp" so the regex below
    //    matches on the first word.
    text = text.replace(/^(\d+)\s+(\d+\/\d+)(\s|$)/, (_, whole, frac, rest) => {
      const [num, den] = frac.split('/').map(Number);
      const value = parseInt(whole) + num / den;
      return value + (rest || ' ');
    });

    // 3) Strip "to taste" variants — keep just the ingredient name.
    //    Covers: "to taste pepper", "salt, to taste", "pepper to taste"
    let toTasteQty = '';
    if (/^to\s+taste\b/i.test(text)) {
      toTasteQty = 'to taste';
      text = text.replace(/^to\s+taste\s*/i, '').trim();
    } else if (/\bto\s+taste\s*$/i.test(text)) {
      toTasteQty = 'to taste';
      text = text.replace(/,?\s*\bto\s+taste\s*$/i, '').trim();
    }

    if (toTasteQty) {
      // Capitalise and return immediately — no quantity splitting needed.
      const itemName = text.replace(/\b\w/g, l => l.toUpperCase());
      return { quantity: toTasteQty, itemName: itemName || 'Item' };
    }
    // ────────────────────────────────────────────────────────────────────────

    // Add custom metrics
    perfTrace.putMetric('input_length', text.length);

    // Split the text into words to analyze
    const words = text.split(/\s+/);
    let quantity = '';
    let itemName = text;

    // Check if first word/part is a quantity (number/fraction with optional unit)
    if (words.length > 0) {
      const firstPart = words[0]!;
      // Check if it's a number/fraction with optional unit attached (like "200g", "1.5kg", "1/2")
      if (/^\d+(\/\d+)?(\.\d+)?[a-zA-Z]*$/.test(firstPart)) {
        quantity = firstPart;
        // Check if next word is a unit
        if (words.length > 1) {
          const potentialUnit = (words[1] || '').toLowerCase();
          // Comprehensive list of units including abbreviations and common terms
          const units = [
            // Volume - Imperial/US Customary
            't', 'tsp', 'teaspoon', 'teaspoons',
            'tbs', 'tb', 'tbl', 'tbsp', 'tblsp', 'tblsps', 'tablespoon', 'tablespoons',
            'c', 'cup', 'cups',
            'fl oz', 'fluid ounce', 'fluid ounces',
            'pt', 'pint', 'pints',
            'qt', 'quart', 'quarts',
            'gal', 'gallon', 'gallons',
            
            // Volume - Metric
            'ml', 'milliliter', 'milliliters',
            'l', 'liter', 'liters',
            'cl', 'centiliter', 'centiliters',
            
            // Weight - Imperial/US Customary
            'oz', 'ounce', 'ounces',
            'lb', 'lbs', 'pound', 'pounds',
            
            // Weight - Metric
            'g', 'gram', 'grams',
            'kg', 'kilogram', 'kilograms',
            
            // Count/Pieces
            'clove', 'cloves', 'bunch', 'bunches', 'sprig', 'sprigs', 'head', 'heads', 
            'stalk', 'stalks', 'slice', 'slices', 'piece', 'pieces', 'part', 'parts', 'dozen',
            'can', 'cans', 'bottle', 'bottles', 'package', 'packages', 'box', 'boxes', 
            'bag', 'bags', 'jar', 'jars', 'container', 'containers',
            
            // Cooking measurements
            'dash', 'dashes', 'pinch', 'pinches', 'handful', 'handfuls', 'scoop', 'scoops',
            'loaf', 'loaves', 'stick', 'sticks', 'block', 'blocks'
          ];
          
          if (units.includes(potentialUnit) || potentialUnit.endsWith('s')) {
            // Check if it's a plural of a known unit
            const singular = potentialUnit.replace(/s$/, '');
            if (units.includes(singular)) {
              quantity += ' ' + words[1];
              itemName = words.slice(2).join(' ');
            } else {
              itemName = words.slice(1).join(' ');
            }
          } else {
            itemName = words.slice(1).join(' ');
          }
        } else {
          itemName = words.slice(1).join(' ');
        }
        perfTrace.putAttribute('parsing_method', 'word_analysis');
      } else if ((firstPart.toLowerCase() === 'a' || firstPart.toLowerCase() === 'an') && words.length > 1) {
        // Handle "a slice of", "a pinch of", "a dash of", "an egg", etc.
        const secondPart = words[1]!.toLowerCase();
        const commonQuantities = ['slice', 'pinch', 'dash', 'handful', 'scoop', 'clove', 'bunch', 'sprig', 'head', 'stalk', 'piece', 'loaf', 'stick', 'block'];
        
        if (commonQuantities.includes(secondPart)) {
          quantity = '1 ' + secondPart;
          itemName = words.slice(2).join(' ');
          // Remove "of" if it follows
          itemName = itemName.replace(/^of\s+/i, '');
          perfTrace.putAttribute('parsing_method', 'article_quantity');
        } else {
          // Bare article ("a garlic clove", "an egg") — strip the article, default qty=1
          quantity = '1';
          itemName = words.slice(1).join(' ');
          perfTrace.putAttribute('parsing_method', 'article_noun');
        }
      } else {
        perfTrace.putAttribute('parsing_method', 'no_quantity');
      }
    }

    // Clean the item name by removing common descriptors, but keep preparation methods for shopping list display
    itemName = itemName
      // Strip parenthetical size/method notes (e.g. "(14.5 oz)", "(optional)", "(or water)")
      .replace(/\s*\([^)]*\)/g, '')
      // Remove common preparation connectors
      .replace(/\b(cut into|sliced into|torn into|chopped into|finely chopped into)\b/gi, '')
      // Remove common size descriptors
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/gi, '')
      // Remove "of" preposition
      .replace(/\bof\s+/gi, '')
      // Remove common quality descriptors
      .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/gi, '');

    // Extract preparation words into notes
    const prepWords = [
      'finely chopped',
      'finely diced',
      'to serve',
      'for serving',
      'minced',
      'chopped',
      'diced',
      'sliced',
      'crushed',
      'ground',
      'grated',
      'divided',
      'peeled',
      'cored',
      'beaten',
      'melted',
      'softened',
      'halved',
      'strips',
      'seeded',
      'shredded',
      'cubed',
      'julienned',
      'torn',
      'plucked'
    ];
    const prepNotesList: string[] = [];
    const prepRegex = new RegExp(`\\b(${prepWords.join('|')})\\b`, 'gi');
    
    itemName = itemName.replace(prepRegex, (match) => {
      prepNotesList.push(match.toLowerCase());
      return '';
    });

    // Remove dangling conjunctions/prepositions at the end of the item name or before commas
    itemName = itemName.replace(/\s*\b(and|or|with|for|to|into)\b\s*(,|$)/gi, '$2');

    // Clean up trailing/leading whitespace and stray commas
     const prepNotes = prepNotesList.length > 0 ? prepNotesList.join(', ') : undefined;

    // If no quantity was found, set default to "1"
    if (!quantity) {
      quantity = '1';
    }

    // Add output metrics
    perfTrace.putMetric('output_quantity_length', quantity.length);
    perfTrace.putMetric('output_item_length', itemName.length);

    return { quantity, itemName, prepNotes };
  } finally {
    perfTrace.stop();
  }
}

/**
 * Cleans item names by removing descriptive words for shopping list display
 * @param itemName Raw item name (e.g., "chopped onions", "minced garlic")
 * @returns Cleaned item name (e.g., "Onions", "Garlic")
 */
export function cleanItemNameForShopping(itemName: string): string {
  let cleaned = itemName.toLowerCase()
    // Remove quantities at the beginning (e.g., "1 ", "2 ", "3 ", etc.)
    .replace(/^\d+\s+/, '')
    // Remove leading store-brand abbreviations (cv = Clover Valley, gv = Great Value)
    .replace(/^(cv|gv)\s+/, '')
    // Remove common size descriptors
    .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
    // Keep color descriptors (like red, green, yellow, black) so items like Red Pepper, Green Beans, Black Beans are distinguished
    // Remove common preparation connectors
    .replace(/\b(cut into|sliced into|torn into|chopped into|finely chopped into)\b/g, '')
    // Remove common preparation descriptors that don't affect core item identity
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely|halved|seeded|shredded|julienned|torn|plucked|to serve|for serving|strips|whole)\b/g, '')
    // Remove units, measurements, and recipe-specific descriptors
    .replace(/\b(tbs|tblsp|tbsp|tbsps|tsp|tsps|tablespoons?|teaspoons?|pinch(es)?|zest and juice|zest|juice|cups?|ounces?|oz|pounds?|lbs?|grams?|g|milliliters?|ml|liters?|l|cloves?|pieces?|slices?|can(ned)?s?|jars?|bottles?|packets?|packs?|bags?|tins?|containers?|tubs?|heads?|bunches?|sprigs?|stalks?|loaves|loaf|tostaste|to taste)\b/g, '')
    // Remove standalone numbers (e.g., "1", "2", "1/2")
    .replace(/\b\d+(\/\d+)?\b/g, '')
    // Remove common quality descriptors
    .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '');

  // Remove dangling conjunctions/prepositions/articles at the end or start of the item name or before commas
  cleaned = cleaned.replace(/\s*\b(and|or|with|for|to|into|of|a|an|the)\b\s*(,|$)/g, '$2');
  cleaned = cleaned.replace(/^\s*\b(and|or|with|for|to|into|of|a|an|the)\b\s*/g, '');

  // Clean up trailing/leading whitespace and stray commas
  cleaned = cleaned.replace(/,\s*$/, '').replace(/\s+,\s+/g, ' ').replace(/^,\s*/, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Capitalize first letter of each word for better display
  cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());

  return cleaned;
}

/**
 * Decide whether ads should be shown to a given user.
 * Current policy: only show ads on native platforms for users on the `free` tier
 * and only while they remain under at least one of their free-tier usage limits
 * (saved recipes, weekly meal-plan recipe additions, or weekly recipe searches).
 * Returns a Promise<boolean>.
 */
export async function canShowAds(user?: User | null): Promise<boolean> {
  try {
    if (!user) return false;
    if (!remoteConfig.getBoolean('ads_enabled')) return false;
    if (remoteConfig.getBoolean('kill_ads')) return false;
    // Don't show ads on web
    if (Capacitor.getPlatform() === 'web') return false;

    const limits = await UsageService.getUsageLimits(user);

    // Don't show ads to paid users (includes household-elevated members)
    if (limits.resolvedTier !== 'free') return false;

    const underRecipeLimit = limits.recipes.max === -1 || (limits.recipes.used < limits.recipes.max);
    const underMealPlanLimit = limits.mealPlanning.weeklyRecipes === -1 || (limits.mealPlanning.weeklyUsed < limits.mealPlanning.weeklyRecipes);
    const underSearchLimit = limits.searches.weekly === -1 || (limits.searches.used < limits.searches.weekly);

    // Show ads when user is within at least one of the usage limits
    return underRecipeLimit || underMealPlanLimit || underSearchLimit;
  } catch {
    // Conservative fallback: show ads for free users if limit check fails
    try {
      if (!user) return false;
      if (!remoteConfig.getBoolean('ads_enabled')) return false;
      if (remoteConfig.getBoolean('kill_ads')) return false;
      return user.subscription?.tier === 'free';
    } catch {
      return false;
    }
  }
}

const isFreshPepper = (name: string): boolean => {
  const low = name.toLowerCase();
  return (low.includes('pepper') || low.includes('peppers')) && 
         !low.includes('black') && 
         !low.includes('white') && 
         !low.includes('cayenne') && 
         !low.includes('szechuan') && 
         !low.includes('peppercorn') && 
         !low.includes('lemon') && 
         !low.includes('chili') && 
         !low.includes('seasoning');
};

export function getItemImage(itemName: string, category: string): string {
  const name = itemName.toLowerCase().trim();
  const cat = category.toLowerCase();

  if (isFreshPepper(name)) {
    return '/images/items/bell_pepper.webp';
  }

  // Clean the item name by removing quantities and common descriptors
  const cleanItemName = (itemName: string): string => {
    return cleanItemNameForShopping(itemName).toLowerCase();
  };

  const cleanedName = cleanItemName(name);

  // Normalize category names from Gemini AI to match our mappings
  const normalizeCategory = (cat: string): string => {
    if (cat.includes('fruit') || cat.includes('vegetable') || cat.includes('produce')) return 'fruit';
    if (cat.includes('dairy') || cat.includes('milk') || cat.includes('cheese') || cat.includes('egg')) return 'dairy';
    if (cat.includes('meat') || cat.includes('poultry') || cat.includes('beef') || cat.includes('chicken')) return 'meat';
    if (cat.includes('seafood') || cat.includes('fish') || cat.includes('salmon')) return 'seafood';
    if (cat.includes('bread') || cat.includes('bakery') || cat.includes('grain')) return 'bakery';
    if (cat.includes('pasta') || cat.includes('noodle')) return 'pasta';
    if (cat.includes('condiment') || cat.includes('sauce')) return 'condiments';
    if (cat.includes('spice') || cat.includes('herb')) return 'spices';
    if (cat.includes('nut')) return 'nuts';
    if (cat.includes('snack')) return 'snacks';
    if (cat.includes('beverage')) return 'beverages';
    if (cat.includes('frozen')) return 'frozen';
    if (cat.includes('baking')) return 'baking';
    if (cat.includes('breakfast')) return 'breakfast';
    if (cat.includes('canned')) return 'canned';
    return cat; // Return original if no match
  };

  // Infer category from item name if category is manual or unknown
  const inferCategoryFromName = (itemName: string): string => {
    const item = itemName.toLowerCase();
    if (item.includes('apple') || item.includes('banana') || item.includes('orange') || item.includes('grape') || item.includes('strawberry') || item.includes('berry')) return 'fruit';
    if (item.includes('carrot') || item.includes('potato') || item.includes('onion') || item.includes('broccoli') || item.includes('spinach') || item.includes('lettuce') || item.includes('tomato')) return 'vegetable';
    if (item.includes('milk') || item.includes('cheese') || item.includes('yogurt') || item.includes('butter') || item.includes('egg')) return 'dairy';
    if (item.includes('chicken') || item.includes('beef') || item.includes('pork') || item.includes('turkey') || item.includes('bacon') || item.includes('sausage')) return 'meat';
    if (item.includes('salmon') || item.includes('fish') || item.includes('shrimp') || item.includes('tuna')) return 'seafood';
    if (item.includes('pasta') || item.includes('noodle') || item.includes('spaghetti') || item.includes('macaroni') || item.includes('lasagna') || item.includes('ravioli') || item.includes('tortellini') || item.includes('ramen') || item.includes('udon') || item.includes('soba') || item.includes('rice noodle')) return 'pasta';
    if (item.includes('bread') || item.includes('rice') || item.includes('cereal') || item.includes('flour') || item.includes('oat') || item.includes('quinoa') || item.includes('barley')) return 'bakery';
    if (item.includes('ketchup') || item.includes('mustard') || item.includes('mayo') || item.includes('sauce') || item.includes('oil')) return 'condiments';
    if (item.includes('salt') || item.includes('pepper') || item.includes('garlic') || item.includes('spice') || item.includes('herb')) return 'spices';
    if (item.includes('peanut') || item.includes('almond') || item.includes('nut')) return 'nuts';
    if (item.includes('chip') || item.includes('cookie') || item.includes('cracker') || item.includes('candy')) return 'snacks';
    if (item.includes('soda') || item.includes('juice') || item.includes('coffee') || item.includes('tea') || item.includes('water')) return 'beverages';
    if (item.includes('frozen') || item.includes('ice cream') || item.includes('pizza')) return 'frozen';
    if (item.includes('sugar') || item.includes('baking') || item.includes('vanilla') || item.includes('chocolate')) return 'baking';
    if (item.includes('canned') || item.includes('can ') || item.includes('soup') || item.includes('bean')) return 'canned';
    return 'manual'; // Default fallback
  };

  const normalizedCat = cat === 'manual' || cat === 'uncategorized' ? inferCategoryFromName(cleanedName) : normalizeCategory(cat);

  // Prefer seeded local item photos when available.
  const seededFilename = resolveSeededItemImageFilename(itemName);
  if (seededFilename) {
    const ext = seededFilename.includes('.') ? '' : '.jpg';
    return `/images/items/${seededFilename}${ext}`;
  }

  // Priority function for image types: png > svg
  const getImagePriority = (image: string): number => {
    if (image.endsWith('.png')) return 2;
    if (image.endsWith('.svg')) return 1;
    return 0;
  };

  // Direct matches for item names - prefer thumb images, then webp, png, svg
  const itemMappings: Record<string, string> = {
    // Fruits
    'apple': 'apple.svg',
    'apples': 'apples.webp',
    'green apple': 'green_apple.webp',
    'red apple': 'red_apple.webp',
    'banana': 'banana.webp',
    'bananas': 'banana.webp',
    'orange': 'orange.webp',
    'oranges': 'orange.webp',
    'strawberry': 'strawberry.webp',
    'strawberries': 'strawberry.webp',
    'cherries': 'cherries.webp',
    'cherry': 'cherry.svg',
    'grapes': 'grapes.svg',
    'grape': 'grapes.svg',
    'lemon': 'lemon.webp',
    'mangos': 'mango.svg',
    'raspberry': 'raspberry.svg',
    'raspberries': 'raspberry.svg',
    'avocado': 'avocado.svg',
    'avocados': 'avocado.svg',
    'coconut': 'coconut.svg',
    'coconuts': 'coconut.svg',
    'olive': 'olive.svg',
    'olives': 'olive.svg',
    // Vegetables
    'carrot': 'carrot.svg',
    'carrots': 'carrot.svg',
    'potato': 'potato.svg',
    'potatoes': 'potato.svg',
    'broccoli': 'broccoli.svg',
    'spinach': 'spinach.svg',
    'tomato': 'tomato.svg',
    'tomatoes': 'tomato.svg',
    'mushrooms': 'mushroom.svg',
    'green beans': 'green_beans.svg',
    'green bean': 'green_beans.svg',
    'chili pepper': 'chili-pepper.svg',
    'chili peppers': 'chili-pepper.svg',
    // Dairy & Eggs
    'egg': 'egg.webp',

    // Meat & Poultry
    'sausage': 'sausage.webp',
    'ham': 'ham.webp',
    'pork': 'pork.webp',
    'hot dog': 'hot_dog.webp',
    'fried chicken': 'fried_chicken.webp',

    // Seafood
    'salmon': 'salmon.svg',
    'baked salmon': 'baked_salmon.webp',
    'crab': 'crab.svg',
    'lobster': 'lobster.svg',
    'steamed lobster': 'steamed_lobster.webp',

    // Grains & Bread
    'muffin': 'muffin.webp',

    // Condiments & Sauces
    'mayonnaise': 'mayonnaise.svg',
    'pickle': 'pickle.webp',

    // Snacks & Nuts
    'almond': 'almond.webp',
    'cashew nuts': 'cashew_nuts.webp',
    'almond butter': 'almond-butter.svg',
    'popcorn': 'pop_corn.webp',
    'walnut': 'walnut.webp',

    // Beverages
    'tea bag': 'tea_bag.webp',
    'apple juice': 'apple_juice.webp',
    'scotch whisky': 'scotch_whisky.webp',

    // Baking & Sweets
    'chocolate': 'chocolate-bar.svg',

    // Canned & Processed
    'tomato puree': 'tomato_puree.webp',

    // Spices & Herbs
    'cinnamon': 'cinnamon-sticks.svg',

    // Other
    'parmesan': 'parmesan.svg',
    'salami': 'salami.svg',
    'whipped cream': 'whipped-cream.svg',
    'soy': 'soy.svg',

    // Thumb images (high priority)
    'milk': '1galmilk.webp',
    '2% milk': '2percentmilk.webp',
    'almond milk': 'almondmilk.webp',
    'eggs': 'eggs.webp',
    'bacon': 'bacon.webp',
    'butter': 'buttersticks.webp',
    'cheese': 'slicedcheese.webp',
    'bread': 'wheatbread.webp',
    'pasta': 'spaghetti.webp',
    'angel hair': 'angelhairnoodles.webp',
    'angel hair pasta': 'angelhairnoodles.webp',
    'barilla angel hair': 'angelhairnoodles.webp',
    'barilla elbows': 'elbownoodles.webp',
    'elbows': 'elbownoodles.webp',
    'elbow pasta': 'elbownoodles.webp',
    'rotini': 'rotininoodles.webp',
    'tri-color rotini': 'rotininoodles.webp',
    'barilla tri-color rotini': 'rotininoodles.webp',
    'barilla': 'spaghetti.webp',
    'fettuccine': 'spaghetti.webp',
    'penne': 'spaghetti.webp',
    'rigatoni': 'spaghetti.webp',
    'ravioli': 'spaghetti.webp',
    'tortellini': 'spaghetti.webp',
    'ramen': 'spaghetti.webp',
    'udon': 'spaghetti.webp',
    'chicken': 'frozenchicken.webp',
    'beef': 'groundbeef.webp',
    'fish': 'frozenfishfilet.webp',
    'shrimp': 'frozenshrimp.webp',
    'steak': 'steak.webp',
    'ketchup': 'ketchup.webp',
    'mustard': 'mustard.webp',
    'mayo': 'mayo.webp',
    'peanut butter': 'peanutbutter.webp',
    'coffee': 'folgerscoffee.webp',
    'ice cream': 'vanillaicecream.webp',
    'cookies': 'cookiesncreamicecream.webp',
    'soup': 'chickennoodlesoup.webp',
    'oatmeal': 'quakeroats.webp',
    'rice': 'rice.webp',
    'flour': 'flour.webp',
    'sugar': 'cakebox.webp',
    'salt': 'saltseason.webp',
    'pepper': 'blackpepperseason.webp',
    'garlic': 'mincedgarlicseason.webp',
    'onion': 'mincedonionseason.webp',
    'oil': 'oilnvinegar.webp',
    'vinegar': 'oilnvinegar.webp',
    'sauce': 'spaghetti.webp',
    'juice': 'applejuice.webp',
    'beer': 'beer.webp',
    'wine': 'oilnvinegar.webp',
    'chips': 'doritos.webp',
    'nuts': 'peanuts.webp',
    'candy': 'mnms.webp',
    'fruit': 'applejuice.webp',
    'vegetable': 'cannedcarrots.webp',
    'canned asparagus': 'cannedasparagus.webp',
    'canned carrots': 'cannedcarrots.webp',
    'canned collard greens': 'cannedcollardgreens.webp',
    'canned corn': 'cannedcorn.webp',
    'canned cream corn': 'cannedcreamcorn.webp',
    'canned diced tomatoes': 'canneddicedtomatos.webp',
    'canned field peas': 'cannedfielpeas.webp',
    'canned french style green beans': 'cannedfrenchstylegreenbeans.webp',
    'canned green beans': 'cannedgreenbeans.webp',
    'canned lima beans': 'cannedlimabeans.webp',
    'canned mixed vegetables': 'cannedmixedvegetables.webp',
    'canned mushrooms': 'cannedmushrooms.webp',
    'canned peas': 'cannedpeas.webp',
    'canned peas and carrots': 'cannedpeasandcarrots.webp',
    'canned potatoes': 'cannedpotatos.webp',
    'canned ravioli': 'cannedravioli.webp',
    'canned yams': 'cannedyams.webp',
    'chicken noodle soup': 'chickennoodlesoup.webp',
    'chicken nuggets': 'chickennuggets.webp',
    'chicken patties': 'chickenpatties.webp',
    'chili seasoning': 'chiliseaon.webp',
    'chocolate cake': 'chocolatecake.webp',
    'chocolate ice cream': 'chocolateicecream.webp',
    'chocolate milk': 'chocolatemilk.webp',
    'cocktail sauce': 'cocktailsauce.webp',
    'coffee creamer': 'coffeecreamer.webp',
    'condensed milk': 'condensedmilkcan.webp',
    'cookie dough': 'cookiedough.webp',
    'cookie dough ice cream': 'cookiedoughicecream.webp',
    'cookies and cream ice cream': 'cookiesncreamicecream.webp',
    'cream cheese': 'creamcheese.webp',
    'cream of chicken soup': 'creamofchickensoup.webp',
    'cream of mushroom soup': 'creamofmushroomsoup.webp',
    'creole seasoning': 'creoleseason.webp',
    'croissant': 'croissant.webp',
    'cupcake': 'cupcake.webp',
    'dinner rolls': 'dinnerrolls.webp',
    'doritos': 'doritos.webp',
    'easy spray cheese': 'easyspraycheese.webp',
    'english muffin': 'englishmuffin.webp',
    'evaporated milk': 'evaporatedmilk.webp',
    'fettuccine noodles': 'fettuccinenoodles.webp',
    'folgers coffee': 'folgerscoffee.webp',
    'french onion soup': 'frenchonionsoup.webp',
    'frozen chicken': 'frozenchicken.webp',
    'frozen chicken breast': 'frozenchickenbreast.webp',
    'frozen chicken tenderloins': 'frozenchickentenderloins.webp',
    'frozen fish filet': 'frozenfishfilet.webp',
    'frozen shrimp': 'frozenshrimp.webp',
    'frozen steak': 'frozensteak.webp',
    'garlic herb seasoning': 'garlicherbseason.webp',
    'garlic powder': 'garlicpowder.webp',
    'grape jelly': 'grapejelly.webp',
    'grated parmesan cheese': 'gratedparmesancheese.webp',
    'ground beef': 'groundbeef.webp',
    'ground cinnamon': 'groundcinnamonseason.webp',
    'half gallon whole milk': 'halfgallonwholemilk.webp',
    'hamburger buns': 'hamburgerbuns.webp',
    'hamburger helper': 'hamburgerhelper.webp',
    'hamburger helper philly cheesesteak': 'hamburgerhelperphillycheesesteak.webp',
    'honey mustard': 'honeymustard.webp',
    'hot dogs': 'hotdogs.webp',
    'hot sauce': 'hotsauce.webp',
    'ice cream fudge bar': 'icecreamfudgebar.webp',
    'ice cream sandwich': 'icecreamsandwich.webp',
    'italian loaf bread': 'italianloafbread.webp',
    'italian seasoning': 'itatlianseason.webp',
    'kraft mac and cheese': 'kraftmacandcheese.webp',
    'lasagna noodles': 'lasagnanoodles.webp',
    'lemon pepper seasoning': 'lemonpepperseason.webp',
    'minced garlic': 'mincedgarlicseason.webp',
    'minced onion': 'mincedonionseason.webp',
    'mint ice cream': 'minticecream.webp',
    'm&ms': 'mnms.webp',
    'parsley seasoning': 'parsleyseason.webp',
    'paprika seasoning': 'paprikaseason.webp',
    'penne noodles': 'pennenoodles.webp',
    'pickles': 'pickles.webp',
    'pinto beans': 'pintobeans.webp',
    'progresso chicken noodle soup': 'progressochickennoodlesoup.webp',
    'quaker oats': 'quakeroats.webp',
    'ramen noodles': 'ramennoodles.webp',
    'ranch dressing': 'ranchdressing.webp',
    'relish': 'relish.webp',
    'rigatoni noodles': 'rigatoninoodles.webp',
    'rotini noodles': 'rotininoodles.webp',
    'shell noodles': 'shellnoodles.webp',
    'shells and cheese': 'shellsandcheese.webp',
    'shredded cheddar cheese': 'shreddedcheddarcheese.webp',
    'shredded parmesan': 'shreddedparmesan.webp',
    'sriracha': 'siracha.webp',
    'sliced cheese': 'slicedcheese.webp',
    'sliced colby jack cheese': 'slicedcolbyjackcheese.webp',
    'sliced pepper jack cheese': 'slicedpepperjackcheese.webp',
    'sliced swiss cheese': 'slicedswisscheese.webp',
    'sour cream': 'sourcream.webp',
    'soy sauce': 'soysauce.webp',
    'spaghetti sauce': 'spegheatisauce.webp',
    'spicy mustard': 'spicymustard.webp',
    'steak sauce': 'steaksauce.webp',
    'string cheese': 'stringcheese.webp',
    'taco seasoning': 'tacoseason.webp',
    'tartar sauce': 'tartarsauce.webp',
    'tomato soup': 'tomatosoup.webp',
    'tortilla': 'tortilla.webp',
    'wheat bread': 'wheatbread.webp',
    'white bread': 'whitebread.webp',
    'white round top bread': 'whiteroundtopbread.webp',
    'whole pickles': 'wholepickles.webp',
    'yum yum sauce': 'yumyumsauce.webp'
  };

  // Check for exact item name matches - prefer longest/most specific matches
  let bestMatch = '';
  let bestImage = '';

  for (const [key, image] of Object.entries(itemMappings)) {
    if (cleanedName.includes(key)) {
      // Prefer longer keys (more specific matches)
      if (key.length > bestMatch.length) {
        bestMatch = key;
        bestImage = image;
      }
      // If same length, prefer higher priority images
      else if (key.length === bestMatch.length) {
        const currentPriority = getImagePriority(image);
        const bestPriority = getImagePriority(bestImage);
        if (currentPriority > bestPriority) {
          bestMatch = key;
          bestImage = image;
        }
      }
    }
  }

  if (bestImage) {
    return `/images/${bestImage}`;
  }

  // Category-based mappings - prefer PNG when available
  const categoryMappings: Record<string, string> = {
    'fruit': 'fruits.webp',
    'vegetable': 'carrot.svg',
    'dairy': 'cheese.webp',
    'meat': 'beef.webp',
    'seafood': 'lobster.svg',
    'pasta': 'spaghetti.webp',
    'bakery': 'pasta.webp',
    'condiments': 'ketchup.webp',
    'spices': 'salt.webp',
    'nuts': 'peanuts.webp',
    'snacks': 'pop_corn.webp',
    'beverages': 'coffee.webp',
    'frozen': 'vanilla_ice_cream.webp',
    'baking': 'flour.webp',
    'breakfast': 'egg.webp',
    'canned': 'tomato_puree.webp'
  };

  for (const [key, image] of Object.entries(categoryMappings)) {
    if (normalizedCat.includes(key)) {
      return `/images/${image}`;
    }
  }

  // Default placeholder
  return '/images/placeholder.svg';
}

export function getPreferredItemDisplayImage(itemName: string, category: string, currentImage?: string | null): string {
  const preferredImage = getItemImage(itemName, category);
  const normalizedCurrentImage = currentImage?.trim();

  if (!normalizedCurrentImage) {
    return preferredImage;
  }

  if (
    normalizedCurrentImage.startsWith('http://') ||
    normalizedCurrentImage.startsWith('https://') ||
    normalizedCurrentImage.startsWith('blob:') ||
    normalizedCurrentImage.startsWith('data:')
  ) {
    return normalizedCurrentImage;
  }

  if (normalizedCurrentImage.startsWith('/images/items/') || normalizedCurrentImage.startsWith('/images/')) {
    return preferredImage;
  }

  return normalizedCurrentImage;
}

/**
 * Returns the Spoonacular CDN URL for an item name if it exists in the
 * seeded image map. Use this in <img onError> handlers to fall back from a
 * missing local file to the CDN before hitting the placeholder.
 */
export function getItemImageCdnUrl(itemName: string): string | null {
  const filename = resolveSeededItemImageFilename(itemName);
  return filename ? `${ITEM_IMAGE_CDN_BASE}${filename}` : null;
}

export function getItemImageLocalPath(itemName: string): string | null {
  const filename = resolveSeededItemImageFilename(itemName);
  return filename ? `/images/items/${filename}` : null;
}

export async function fetchExternalItemImage(itemName: string): Promise<string | null> {
  // Import the service dynamically to avoid circular dependencies
  const { fetchGroceryItemImage } = await import('../services/imageService');
  return await fetchGroceryItemImage(itemName);
}

export function getStorageLocationImage(location: string): string {
  const locationMappings: Record<string, string> = {
    'pantry': '/images/pantry.svg',
    'fridge': '/images/fridge.svg', 
    'freezer': '/images/freezer.svg',
    'spices': '/images/spices.svg',
    'other': '/images/other.svg'
  };

  return locationMappings[location] || '/images/placeholder.svg';
}

export function inferCategoryFromItemName(itemName: string | undefined): string {
  if (!itemName || typeof itemName !== 'string') return 'Other';
  const item = itemName.toLowerCase();
  if (item.includes('apple') || item.includes('banana') || item.includes('orange') || item.includes('grape') || item.includes('strawberry') || item.includes('berry')) return 'Fruits & Vegetables';
  if (item.includes('carrot') || item.includes('potato') || item.includes('onion') || item.includes('broccoli') || item.includes('spinach') || item.includes('lettuce') || item.includes('tomato')) return 'Fruits & Vegetables';
  if (item.includes('milk') || item.includes('cheese') || item.includes('yogurt') || item.includes('butter') || item.includes('egg')) return 'Dairy & Eggs';
  if (item.includes('chicken') || item.includes('beef') || item.includes('pork') || item.includes('turkey') || item.includes('bacon') || item.includes('sausage')) return 'Meat & Poultry';
  if (item.includes('salmon') || item.includes('fish') || item.includes('shrimp') || item.includes('tuna')) return 'Seafood';
  if (item.includes('pasta') || item.includes('noodle') || item.includes('spaghetti') || item.includes('macaroni') || item.includes('lasagna') || item.includes('ravioli') || item.includes('tortellini') || item.includes('ramen') || item.includes('udon') || item.includes('soba') || item.includes('rice noodle')) return 'Pasta & Noodles';
  if (item.includes('bread') || item.includes('rice') || item.includes('cereal') || item.includes('flour') || item.includes('oat') || item.includes('quinoa') || item.includes('barley')) return 'Grains & Bread';
  if (item.includes('ketchup') || item.includes('mustard') || item.includes('mayo') || item.includes('sauce') || item.includes('oil')) return 'Condiments & Sauces';
  if (item.includes('salt') || item.includes('pepper') || item.includes('garlic') || item.includes('spice') || item.includes('herb')) return 'Spices & Herbs';
  if (item.includes('peanut') || item.includes('almond') || item.includes('nut')) return 'Snacks';
  if (item.includes('chip') || item.includes('cookie') || item.includes('cracker') || item.includes('candy')) return 'Snacks';
  if (item.includes('soda') || item.includes('juice') || item.includes('coffee') || item.includes('tea') || item.includes('water')) return 'Beverages';
  if (item.includes('frozen') || item.includes('ice cream') || item.includes('pizza')) return 'Frozen Foods';
  if (item.includes('sugar') || item.includes('baking') || item.includes('vanilla') || item.includes('chocolate')) return 'Baking Supplies';
  if (item.includes('canned') || item.includes('can ') || item.includes('soup') || item.includes('bean')) return 'Canned Goods';
  return 'Uncategorized'; // Default fallback
}

export interface CategorySuggestion {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export function getCategorySuggestions(itemName: string): CategorySuggestion[] {
  const item = itemName.toLowerCase();
  const suggestions: CategorySuggestion[] = [];

  // High confidence matches
  if (item.includes('cheddar') || item.includes('mozzarella') || item.includes('parmesan') || item.includes('swiss')) {
    suggestions.push({
      category: 'Dairy & Eggs',
      confidence: 'high',
      reasoning: 'Cheese varieties typically belong to dairy'
    });
  }

  if (item.includes('apple') || item.includes('banana') || item.includes('orange') || item.includes('grape')) {
    suggestions.push({
      category: 'Fruits & Vegetables',
      confidence: 'high',
      reasoning: 'Common fruits'
    });
  }

  if (item.includes('milk') || item.includes('yogurt') || item.includes('butter')) {
    suggestions.push({
      category: 'Dairy & Eggs',
      confidence: 'high',
      reasoning: 'Dairy products'
    });
  }

  if (item.includes('chicken') || item.includes('beef') || item.includes('pork') || item.includes('turkey')) {
    suggestions.push({
      category: 'Meat & Poultry',
      confidence: 'high',
      reasoning: 'Meat and poultry products'
    });
  }

  if (item.includes('pasta') || item.includes('spaghetti') || item.includes('macaroni')) {
    suggestions.push({
      category: 'Pasta & Noodles',
      confidence: 'high',
      reasoning: 'Pasta varieties'
    });
  }

  if (item.includes('bread') || item.includes('rice') || item.includes('cereal')) {
    suggestions.push({
      category: 'Grains & Bread',
      confidence: 'high',
      reasoning: 'Grain and bread products'
    });
  }

  // Medium confidence matches
  if (item.includes('chip') || item.includes('cookie') || item.includes('cracker')) {
    suggestions.push({
      category: 'Snacks',
      confidence: 'medium',
      reasoning: 'Snack foods'
    });
  }

  if (item.includes('soda') || item.includes('juice') || item.includes('coffee')) {
    suggestions.push({
      category: 'Beverages',
      confidence: 'medium',
      reasoning: 'Beverages and drinks'
    });
  }

  if (item.includes('frozen') || item.includes('ice cream')) {
    suggestions.push({
      category: 'Frozen Foods',
      confidence: 'medium',
      reasoning: 'Frozen items'
    });
  }

  if (item.includes('soup') || item.includes('canned')) {
    suggestions.push({
      category: 'Canned Goods',
      confidence: 'medium',
      reasoning: 'Canned or packaged foods'
    });
  }

  // Low confidence fallback
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'Uncategorized',
      confidence: 'low',
      reasoning: 'Unable to determine category from item name'
    });
  }

  // Sort by confidence (high first)
  return suggestions.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.confidence] - order[a.confidence];
  });
}

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

  // Long-term storage items should not have expiration dates
  const longTermCategories = ['pasta & noodles', 'grains & bread', 'canned goods', 'baking supplies', 'condiments & sauces', 'spices & herbs', 'snacks', 'beverages'];
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
    // Leafy greens: 3-5 days, root vegetables: 7-14 days
    const days = (name.includes('lettuce') || name.includes('spinach') || name.includes('kale')) ? 4 :
                 (name.includes('carrot') || name.includes('potato') || name.includes('onion')) ? 14 : 7;
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
 * Generates consumption pattern suggestions based on inventory history
 * @param inventory Current inventory items
 * @returns Array of consumption suggestions
 */
export function generateConsumptionSuggestions(inventory: PantryItem[]): ConsumptionSuggestion[] {
  const suggestions: ConsumptionSuggestion[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out undefined or invalid items
  const validInventory = inventory.filter(item => item && typeof item === 'object' && item.id);

  validInventory.forEach(item => {
    if (!item.consumptionHistory || item.consumptionHistory.length < 2) {
      return; // Need at least 2 data points for patterns
    }

    const history = item.consumptionHistory
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());

    // Calculate average interval between purchases
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (!curr || !prev) continue;
      const days = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0 && days < 90) { // Ignore intervals longer than 3 months
        intervals.push(days);
      }
    }

    if (intervals.length === 0) return;

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const lastPurchase = history[history.length - 1];
    if (!lastPurchase) return; // defensive
    const daysSinceLastPurchase = Math.floor((today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));

    // Suggest restocking if it's been longer than average interval
    if (daysSinceLastPurchase > averageInterval * 1.2) {
      const confidence = Math.min(0.9, intervals.length / 5); // Higher confidence with more data points
      suggestions.push({
        item: item.item,
        category: item.category,
        suggestedAction: 'restock',
        reason: `You usually buy this every ${Math.round(averageInterval)} days. It's been ${daysSinceLastPurchase} days.`,
        confidence,
        daysSinceLastPurchase,
        averageInterval: Math.round(averageInterval)
      });
    }
    // Suggest considering buying if approaching the interval
    else if (daysSinceLastPurchase > averageInterval * 0.8) {
      const confidence = Math.min(0.7, intervals.length / 7);
      suggestions.push({
        item: item.item,
        category: item.category,
        suggestedAction: 'consider_buying',
        reason: `You usually buy this every ${Math.round(averageInterval)} days. It's been ${daysSinceLastPurchase} days.`,
        confidence,
        daysSinceLastPurchase,
        averageInterval: Math.round(averageInterval)
      });
    }
  });

  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

/**
 * Generates expiration alerts with different levels
 * @param inventory Current inventory items
 * @returns Array of expiration alerts
 */
export function generateExpirationAlerts(inventory: PantryItem[]): ExpirationAlert[] {
  const alerts: ExpirationAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  inventory.forEach(item => {
    // Skip immortal items entirely
    if (item.is_immortal) return;

    const isFrozen = item.is_frozen || item.storageLocation === 'freezer';
    // Frozen: prefer freezerExpiry; non-frozen: use expirationDate
    const activeDateStr = isFrozen ? (item.freezerExpiry || item.expirationDate) : item.expirationDate;
    if (!activeDateStr) return;

    const activeDate = new Date(activeDateStr);
    const todayDate = new Date(today);
    const daysRemaining = Math.ceil((activeDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    const expirationType = item.expirationType || 'best-by';
    let alertLevel: 'expired' | 'critical' | 'warning' | 'info';
    let message: string;

    if (isFrozen) {
      // Frozen items: only surface alerts within RC-configured window; use gentler language
      if (daysRemaining < 0) {
        alertLevel = 'expired';
        message = `${item.item} is past its freezer date`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_critical_days')) {
        alertLevel = 'critical';
        message = `${item.item} should be used within ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (frozen)`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_frozen_alert_days')) {
        alertLevel = 'warning';
        message = `${item.item} is best used within ${daysRemaining} days (frozen)`;
      } else {
        return; // Plenty of freezer time left
      }
    } else {
      // Special handling for milk - only warn when 3 days or less remain
      const isMilk = item.item.toLowerCase().includes('milk') || item.category.toLowerCase() === 'dairy';
      const warningThreshold = isMilk ? remoteConfig.getNumber('expiry_warning_days') : remoteConfig.getNumber('expiry_info_days');

      if (daysRemaining < 0) {
        alertLevel = 'expired';
        message = `${item.item} has expired!`;
      } else if (daysRemaining === 0) {
        alertLevel = 'critical';
        message = `${item.item} expires today!`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_critical_days')) {
        alertLevel = 'critical';
        message = `${item.item} expires in ${daysRemaining} day!`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_warning_days')) {
        alertLevel = 'warning';
        message = `${item.item} expires in ${daysRemaining} days`;
      } else if (daysRemaining <= warningThreshold) {
        alertLevel = 'info';
        message = `${item.item} expires in ${daysRemaining} days`;
      } else {
        return; // No alert needed
      }
    }

    alerts.push({
      itemId: item.id,
      itemName: item.item,
      daysRemaining,
      alertLevel,
      expirationType,
      message
    });
  });

  // Sort by urgency (expired first, then by days remaining)
  return alerts.sort((a, b) => {
    if (a.alertLevel === 'expired' && b.alertLevel !== 'expired') return -1;
    if (b.alertLevel === 'expired' && a.alertLevel !== 'expired') return 1;
    return a.daysRemaining - b.daysRemaining;
  });
}

/**
 * Generates recipe suggestions for items expiring soon
 * @param inventory Array of pantry items
 * @returns Array of recipe suggestions
 */
export function generateRecipeSuggestions(inventory: PantryItem[]): RecipeSuggestion[] {
  const suggestions: RecipeSuggestion[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Recipe suggestions based on common ingredients and expiration timeframes
  const recipeMap: Record<string, string[]> = {
    // Vegetables
    'lettuce': ['Caesar Salad', 'Garden Salad', 'BLT Sandwich', 'Taco Salad'],
    'spinach': ['Spinach Salad', 'Smoothie', 'Quiche', 'Pasta with Spinach'],
    'tomato': ['Caprese Salad', 'BLT Sandwich', 'Tomato Soup', 'Pasta Sauce'],
    'cucumber': ['Cucumber Salad', 'Greek Salad', 'Sandwiches', 'Tzatziki'],
    'carrot': ['Carrot Soup', 'Carrot Salad', 'Stir Fry', 'Roasted Vegetables'],
    'broccoli': ['Steamed Broccoli', 'Stir Fry', 'Broccoli Soup', 'Broccoli Casserole'],
    'bell pepper': ['Stir Fry', 'Stuffed Peppers', 'Fajitas', 'Pepper Salad'],
    'onion': ['Caramelized Onions', 'Soup', 'Stir Fry', 'French Onion Soup'],
    'garlic': ['Garlic Bread', 'Pasta Sauce', 'Roasted Garlic', 'Stir Fry'],
    'potato': ['Mashed Potatoes', 'Baked Potato', 'Potato Soup', 'Roasted Potatoes'],
    'avocado': ['Guacamole', 'Avocado Toast', 'Salad', 'Smoothie'],

    // Fruits
    'banana': ['Banana Bread', 'Smoothie', 'Banana Split', 'Fruit Salad'],
    'apple': ['Apple Pie', 'Apple Sauce', 'Fruit Salad', 'Apple Crisp'],
    'orange': ['Orange Juice', 'Fruit Salad', 'Orange Chicken', 'Smoothie'],
    'lemon': ['Lemonade', 'Lemon Chicken', 'Salad Dressing', 'Lemon Bars'],
    'berries': ['Berry Smoothie', 'Fruit Salad', 'Berry Pie', 'Yogurt Parfait'],

    // Dairy
    'milk': ['Cereal', 'Pancakes', 'Hot Chocolate', 'Mac and Cheese'],
    'cheese': ['Grilled Cheese', 'Mac and Cheese', 'Cheese Quesadilla', 'Pizza'],
    'yogurt': ['Parfait', 'Smoothie', 'Marinade', 'Frozen Yogurt'],
    'eggs': ['Scrambled Eggs', 'Omelette', 'Quiche', 'Egg Salad'],

    // Proteins
    'chicken': ['Grilled Chicken', 'Chicken Soup', 'Chicken Stir Fry', 'Chicken Salad'],
    'beef': ['Beef Stew', 'Hamburger', 'Beef Tacos', 'Roast Beef'],
    'fish': ['Grilled Fish', 'Fish Tacos', 'Fish Soup', 'Baked Fish'],
    'tofu': ['Stir Fry', 'Tofu Curry', 'Tofu Scramble', 'Tofu Stir Fry'],

    // Other
    'bread': ['Sandwich', 'French Toast', 'Bread Pudding', 'Garlic Bread'],
    'pasta': ['Pasta Salad', 'Mac and Cheese', 'Pasta Primavera', 'Spaghetti'],
    'rice': ['Fried Rice', 'Rice Pilaf', 'Rice Pudding', 'Risotto']
  };

  inventory.forEach(item => {
    if (!item.expirationDate) return;

    const expirationDate = new Date(item.expirationDate);
    const todayDate = new Date(today);
    const daysRemaining = Math.ceil((expirationDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    // Only suggest recipes for items expiring within RC-configured window
    if (daysRemaining < 0 || daysRemaining > remoteConfig.getNumber('expiry_recipe_suggestion_days')) return;

    // Find recipes based on item name (case insensitive partial match)
    const itemNameLower = item.item.toLowerCase();
    let suggestedRecipes: string[] = [];

    // Check for exact matches first
    if (recipeMap[itemNameLower]) {
      suggestedRecipes = recipeMap[itemNameLower];
    } else {
      // Check for partial matches
      for (const [key, recipes] of Object.entries(recipeMap)) {
        if (itemNameLower.includes(key) || key.includes(itemNameLower)) {
          suggestedRecipes = recipes;
          break;
        }
      }
    }

    // If no specific recipes found, provide generic suggestions based on category
    if (suggestedRecipes.length === 0) {
      const category = item.category.toLowerCase();
      if (category.includes('vegetable') || category.includes('fruit')) {
        suggestedRecipes = ['Salad', 'Smoothie', 'Stir Fry', 'Soup'];
      } else if (category.includes('dairy')) {
        suggestedRecipes = ['Casserole', 'Sauce', 'Baked Dish', 'Smoothie'];
      } else if (category.includes('protein') || category.includes('meat')) {
        suggestedRecipes = ['Stir Fry', 'Grilled', 'Baked', 'Stew'];
      } else {
        suggestedRecipes = ['Quick Meal', 'Simple Recipe', 'Easy Dish'];
      }
    }

    if (suggestedRecipes.length > 0) {
      let reason = '';
      if (daysRemaining <= 1) {
        reason = `expires ${daysRemaining === 0 ? 'today' : 'tomorrow'} - use it now!`;
      } else if (daysRemaining <= 3) {
        reason = `expires in ${daysRemaining} days - perfect time to cook`;
      } else {
        reason = `expires in ${daysRemaining} days - great for meal planning`;
      }

      suggestions.push({
        itemId: item.id,
        itemName: item.item,
        daysRemaining,
        suggestedRecipes: suggestedRecipes.slice(0, 3), // Limit to 3 suggestions
        reason
      });
    }
  });

  // Sort by urgency (soonest expiring first)
  return suggestions.sort((a, b) => a.daysRemaining - b.daysRemaining);
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

// Custom Category Management Functions

/**
 * Creates a new custom category
 * @param name Category name
 * @param icon Emoji or icon name
 * @param color Optional hex color
 * @param userId User ID
 * @returns New CustomCategory object
 */
export function createCustomCategory(name: string, icon: string, color: string = '#4CAF50', userId: string): CustomCategory {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    icon,
    color,
    createdAt: new Date().toISOString(),
    userId
  };
}

/**
 * Gets all available categories (default + custom)
 * @param customCategories User's custom categories
 * @returns Array of all category names
 */
export function getAllCategories(customCategories: CustomCategory[] = []): string[] {
  const defaultCategories = [
    'Fruits & Vegetables',
    'Dairy & Eggs',
    'Meat & Poultry',
    'Seafood',
    'Pasta & Noodles',
    'Grains & Bread',
    'Condiments & Sauces',
    'Spices & Herbs',
    'Snacks',
    'Beverages',
    'Frozen Foods',
    'Baking Supplies',
    'Breakfast Foods',
    'Canned Goods',
    'Leftovers'
  ];

  const customCategoryNames = customCategories.map(cat => cat.name);
  return [...defaultCategories, ...customCategoryNames];
}

/**
 * Gets category icon (emoji for custom, image path for default)
 * @param categoryName Category name
 * @param customCategories User's custom categories
 * @returns Icon string or image path
 */
export function getCategoryIcon(categoryName: string, customCategories: CustomCategory[] = []): string {
  // Check if it's a custom category
  const customCategory = customCategories.find(cat => cat.name === categoryName);
  if (customCategory) {
    return customCategory.icon;
  }

  // Default category icons (using emojis for consistency)
  const defaultIcons: Record<string, string> = {
    'Fruits & Vegetables': '🥕',
    'Dairy & Eggs': '🥛',
    'Meat & Poultry': '🥩',
    'Seafood': '🐟',
    'Pasta & Noodles': '🍝',
    'Grains & Bread': '🍞',
    'Condiments & Sauces': '🧂',
    'Spices & Herbs': '🌿',
    'Snacks': '🍿',
    'Beverages': '🥤',
    'Frozen Foods': '🧊',
    'Baking Supplies': '🧁',
    'Breakfast Foods': '🥞',
    'Canned Goods': '🥫',
    'Leftovers': '🥡'
  };

  return defaultIcons[categoryName] || '📦';
}

/**
 * Gets category color
 * @param categoryName Category name
 * @param customCategories User's custom categories
 * @returns Hex color code
 */
export function getCategoryColor(categoryName: string, customCategories: CustomCategory[] = []): string {
  // Check if it's a custom category
  const customCategory = customCategories.find(cat => cat.name === categoryName);
  if (customCategory) {
    return customCategory.color || '#4CAF50';
  }

  // Default category colors
  const defaultColors: Record<string, string> = {
    'Fruits & Vegetables': '#4CAF50',
    'Dairy & Eggs': '#2196F3',
    'Meat & Poultry': '#F44336',
    'Seafood': '#00BCD4',
    'Pasta & Noodles': '#FF9800',
    'Grains & Bread': '#9C27B0',
    'Condiments & Sauces': '#795548',
    'Spices & Herbs': '#8BC34A',
    'Snacks': '#FFC107',
    'Beverages': '#3F51B5',
    'Frozen Foods': '#00ACC1',
    'Baking Supplies': '#E91E63',
    'Breakfast Foods': '#FF5722',
    'Canned Goods': '#607D8B',
    'Leftovers': '#FF8F00'
  };

  return defaultColors[categoryName] || '#9E9E9E';
}

/**
 * Validates custom category data
 * @param name Category name
 * @param icon Icon/emoji
 * @param customCategories Existing custom categories
 * @returns Validation result
 */
export function validateCustomCategory(name: string, icon: string, customCategories: CustomCategory[] = []): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Category name is required' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Category name must be at least 2 characters' };
  }

  if (name.trim().length > 50) {
    return { valid: false, error: 'Category name must be less than 50 characters' };
  }

  // Check for duplicate names
  const existingNames = customCategories.map(cat => cat.name.toLowerCase());
  if (existingNames.includes(name.trim().toLowerCase())) {
    return { valid: false, error: 'A category with this name already exists' };
  }

  if (!icon.trim()) {
    return { valid: false, error: 'Category icon is required' };
  }

  return { valid: true };
}

// Enhanced quantity management utilities
export interface ParsedQuantity {
  amount: number;
  unit: string;
}

export interface QuantityResult {
  amount: number;
  unit: string;
  normalizedGrams?: number; // For comparison
}

// Unit conversion factors (to grams or milliliters)
const UNIT_CONVERSIONS: Record<string, number> = {
  // Weight
  'g': 1,
  'gram': 1,
  'grams': 1,
  'kg': 1000,
  'kilogram': 1000,
  'kilograms': 1000,
  'oz': 28.35,
  'ounce': 28.35,
  'ounces': 28.35,
  'lb': 453.59,
  'pound': 453.59,
  'pounds': 453.59,

  // Volume (approximate conversions to ml)
  'ml': 1,
  'milliliter': 1,
  'milliliters': 1,
  'l': 1000,
  'liter': 1000,
  'liters': 1000,
  'cup': 236.59,
  'cups': 236.59,
  'tbsp': 14.79,
  'tablespoon': 14.79,
  'tablespoons': 14.79,
  'tsp': 4.93,
  'teaspoon': 4.93,
  'teaspoons': 4.93,
  'qt': 946.35,
  'quart': 946.35,
  'quarts': 946.35,
  'pt': 473.18,
  'pint': 473.18,
  'pints': 473.18,
  'gal': 3785.41,
  'gallon': 3785.41,
  'gallons': 3785.41,

  // Count units (no conversion)
  'count': 1,
  'piece': 1,
  'pieces': 1,
  'slice': 1,
  'slices': 1,
  'clove': 1,
  'cloves': 1,
  'can': 1,
  'cans': 1,
  'bottle': 1,
  'bottles': 1,
  'package': 1,
  'packages': 1,
  'pkg': 1,
  'box': 1,
  'boxes': 1,
  'bag': 1,
  'bags': 1,
  'bunch': 1,
  'bunches': 1,
  'head': 1,
  'heads': 1,
  'stalk': 1,
  'stalks': 1,
  'sprig': 1,
  'sprigs': 1,
  'dash': 1,
  'pinch': 1,
};

/**
 * Parse a quantity string like "1 1/2 cups" or "2.5 oz" into structured data
 */
export function parseQuantity(quantityText: string): ParsedQuantity | null {
  if (!quantityText || typeof quantityText !== 'string') {
    return null;
  }

  const text = quantityText.trim().toLowerCase();

  // Handle fractions like "1 1/2" -> 1.5
  const fractionRegex = /(\d+)\s+(\d+)\/(\d+)/;
  let processedText = text;
  const fractionMatch = text.match(fractionRegex);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1] ?? '0', 10);
    const numerator = parseInt(fractionMatch[2] ?? '0', 10);
    const denominator = parseInt(fractionMatch[3] ?? '1', 10);
    const decimal = whole + (numerator / Math.max(1, denominator));
    processedText = text.replace(fractionMatch[0], decimal.toString());
  }

  // Handle simple fractions like "1/2"
  const simpleFractionRegex = /(\d+)\/(\d+)/;
  const simpleMatch = processedText.match(simpleFractionRegex);
  if (simpleMatch && !fractionMatch) {
    const numerator = parseInt(simpleMatch[1] ?? '0', 10);
    const denominator = parseInt(simpleMatch[2] ?? '1', 10);
    const decimal = numerator / Math.max(1, denominator);
    processedText = processedText.replace(simpleMatch[0], decimal.toString());
  }

  // Extract number and unit
  const match = processedText.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (!match) {
    return null;
  }

  const amount = parseFloat(match[1] ?? '0');
  const unitRaw = (match[2] ?? '').trim();
  const unitKey = unitRaw.toLowerCase();

  // Find conversion for unit or plural form
  const resolvedUnit = UNIT_CONVERSIONS[unitKey]
    ? unitKey
    : UNIT_CONVERSIONS[unitKey + 's']
    ? unitKey + 's'
    : undefined;

  if (!resolvedUnit) return null;

  return {
    amount,
    unit: resolvedUnit
  };
}

/**
 * Convert quantity to normalized grams/ml for comparison
 */
export function normalizeQuantity(quantity: ParsedQuantity): QuantityResult {
  const key = quantity.unit.toLowerCase();
  const conversionFactor = UNIT_CONVERSIONS[key] ?? UNIT_CONVERSIONS[key + 's'];
  if (!conversionFactor) {
    return { ...quantity };
  }

  // For weight/volume units, convert to grams/ml
  const lowUnit = key;
  if (['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds'].includes(lowUnit)) {
    return {
      ...quantity,
      normalizedGrams: quantity.amount * conversionFactor
    };
  }

  if (['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'qt', 'quart', 'quarts', 'pt', 'pint', 'pints', 'gal', 'gallon', 'gallons'].includes(lowUnit)) {
    return {
      ...quantity,
      normalizedGrams: quantity.amount * conversionFactor // Using grams field for volume too
    };
  }

  // For count units, no normalization needed
  return { ...quantity };
}

/**
 * Check if two quantities can be combined (same unit type)
 */
export function canCombineQuantities(q1: ParsedQuantity, q2: ParsedQuantity): boolean {
  const n1 = normalizeQuantity(q1);
  const n2 = normalizeQuantity(q2);

  // Both have normalization (weight/volume) or both don't (count)
  return (n1.normalizedGrams !== undefined) === (n2.normalizedGrams !== undefined);
}

/**
 * Combine two quantities of the same type
 */
export function combineQuantities(q1: ParsedQuantity, q2: ParsedQuantity): ParsedQuantity {
  if (!canCombineQuantities(q1, q2)) {
    throw new Error('Cannot combine quantities of different types');
  }

  const n1 = normalizeQuantity(q1);
  const n2 = normalizeQuantity(q2);

  if (n1.normalizedGrams !== undefined && n2.normalizedGrams !== undefined) {
    // Convert both to grams/ml, add, then convert back to first unit
    const totalGrams = n1.normalizedGrams + n2.normalizedGrams;
    const conv = UNIT_CONVERSIONS[q1.unit.toLowerCase()] ?? UNIT_CONVERSIONS[q1.unit.toLowerCase() + 's'];
    const amountInOriginalUnit = conv ? totalGrams / conv : totalGrams;
    return {
      amount: Math.round(amountInOriginalUnit * 100) / 100, // Round to 2 decimal places
      unit: q1.unit
    };
  }

  // For count units, just add amounts
  return {
    amount: q1.amount + q2.amount,
    unit: q1.unit
  };
}

/**
 * Subtract one quantity from another
 */
export function subtractQuantities(total: ParsedQuantity, used: ParsedQuantity): ParsedQuantity | null {
  if (!canCombineQuantities(total, used)) {
    return null; // Cannot subtract different types
  }

  const nTotal = normalizeQuantity(total);
  const nUsed = normalizeQuantity(used);

  if (nTotal.normalizedGrams !== undefined && nUsed.normalizedGrams !== undefined) {
    const remainingGrams = nTotal.normalizedGrams - nUsed.normalizedGrams;
    if (remainingGrams <= 0) return null; // All used up

    const conv = UNIT_CONVERSIONS[total.unit.toLowerCase()] ?? UNIT_CONVERSIONS[total.unit.toLowerCase() + 's'];
    const amountInOriginalUnit = conv ? remainingGrams / conv : remainingGrams;
    return {
      amount: Math.round(amountInOriginalUnit * 100) / 100,
      unit: total.unit
    };
  }

  // For count units
  const remaining = total.amount - used.amount;
  if (remaining <= 0) return null;

  return {
    amount: remaining,
    unit: total.unit
  };
}

/**
 * Format quantity for display, handling both old and new quantity systems
 * Shows available quantity (total - reserved)
 */
export function formatItemQuantity(item: PantryItem): string {
  const totalAmount = getQuantityAmount(item.quantity ?? item.quantity_estimate);
  const unit = getQuantityUnit(item.quantity ?? item.quantity_estimate);

  // Calculate reserved amount
  const reservedAmount = item.reservations?.reduce((sum, res) => sum + (res?.quantity || 0), 0) || 0;
  const availableAmount = Math.max(0, totalAmount - reservedAmount);

  // Format common fractions nicely
  let displayAmount: string;
  if (availableAmount === 0.25) displayAmount = '¼';
  else if (availableAmount === 0.5) displayAmount = '½';
  else if (availableAmount === 0.75) displayAmount = '¾';
  else displayAmount = availableAmount.toString();

  const quantityText = `${displayAmount} ${unit}`;

  // Add reservation info if there are reservations
  if (reservedAmount > 0) {
    let reservedDisplay: string;
    if (reservedAmount === 0.25) reservedDisplay = '¼';
    else if (reservedAmount === 0.5) reservedDisplay = '½';
    else if (reservedAmount === 0.75) reservedDisplay = '¾';
    else reservedDisplay = reservedAmount.toString();

    return `${quantityText} (${reservedDisplay} reserved)`;
  }

  return quantityText;
}

/**
 * Generates a blur data URL for progressive image loading
 * Creates a simple colored rectangle as a placeholder
 * @param width Image width
 * @param height Image height
 * @param color Background color (hex format, defaults to theme color)
 * @returns Data URL for blurred placeholder
 */
export function generateBlurDataURL(width: number = 400, height: number = 300, color: string = '#f3f4f6'): string {
  // Create a simple SVG with the specified color
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `;

  // Convert SVG to base64 data URL
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Parses a numeric quantity string, including fractions (e.g. "1/2", "3/4") and decimals
 */
export function parseNumericQuantity(qtyStr: string): number {
  if (!qtyStr) return 1;
  const str = qtyStr.trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]!);
      const den = parseFloat(parts[1]!);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }
  const val = parseFloat(str);
  return isNaN(val) ? 1 : val;
}

/**
 * Deducts recipe ingredient quantity from pantry item quantity, taking unit conversions into account
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deductIngredientAmount(pantryQtyObj: any, recipeQtyStr: string): { amount: number; unit: string } {
  const pantryAmount = getQuantityAmount(pantryQtyObj);
  const pantryUnit = getQuantityUnit(pantryQtyObj);

  const parsedRecipe = parseIngredientForShoppingList(recipeQtyStr);
  const recipeParts = parsedRecipe.quantity.trim().split(/\s+/);
  let recipeAmount = 1;
  let recipeUnit = 'count';

  if (recipeParts.length > 0) {
    recipeAmount = parseNumericQuantity(recipeParts[0]!);
    if (recipeParts.length > 1) {
      recipeUnit = recipeParts[1]!.toLowerCase();
    }
  }

  const pUnitLower = pantryUnit.toLowerCase();
  const rUnitLower = recipeUnit.toLowerCase();

  // Case 1: Units match
  if (pUnitLower === rUnitLower) {
    return {
      amount: Math.max(0, pantryAmount - recipeAmount),
      unit: pantryUnit
    };
  }

  // Case 2: Standard/Metric conversions
  const pMetric = convertToMetric(pantryAmount, pantryUnit);
  const rMetric = convertToMetric(recipeAmount, recipeUnit);

  if (pMetric.unit === rMetric.unit && pMetric.unit !== pantryUnit) {
    const remainingMetric = Math.max(0, pMetric.amount - rMetric.amount);
    const backToOriginal = convertToStandard(remainingMetric, pMetric.unit);
    return {
      amount: Math.round(backToOriginal.amount * 100) / 100,
      unit: pantryUnit
    };
  }

  // Case 3: Both are countable units (e.g. piece vs count, slices vs pieces)
  const isCountUnit = (u: string) => ['count', 'pieces', 'cloves', 'slices', 'sticks', 'cans', 'bottles', 'packages', 'bags', 'boxes', 'jars'].includes(u);
  if (isCountUnit(pUnitLower) && isCountUnit(rUnitLower)) {
    return {
      amount: Math.max(0, pantryAmount - recipeAmount),
      unit: pantryUnit
    };
  }

  // Mismatched units that cannot be converted: deplete the item (set to 0)
  return {
    amount: 0,
    unit: pantryUnit
  };
}

/**
 * Checks if a food item is immortal (e.g., honey, salt, sugar) and doesn't expire
 */
export function isImmortalItem(itemName: string): boolean {
  const low = itemName.toLowerCase();
  return low.includes('honey') || low.includes('salt') || low.includes('sugar');
}

/**
 * Checks if a food item contains cooked rice
 */
export function isCookedRiceItem(itemName: string): boolean {
  const low = itemName.toLowerCase();
  return (low.includes('rice') && low.includes('cooked')) ||
         (low.includes('rice') && low.includes('leftover'));
}
