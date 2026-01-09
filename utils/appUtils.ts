import { doc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DayPlan } from '../types';
import { ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, PantryItem, CustomCategory } from '../types';
import { getPerformance, trace } from "firebase/performance";

const performance = getPerformance();

export async function saveDayPlan(householdId: string, day: DayPlan) {
  const id = day.date; // 'YYYY-MM-DD'
  const ref = doc(db, 'households', householdId, 'mealPlan', id);
  await setDoc(ref, {
    date: Timestamp.fromDate(new Date(day.date)),
    breakfast: day.breakfast || [],
    lunch: day.lunch || [],
    dinner: day.dinner || [],
    lastModifiedBy: localStorage.getItem('clientId') || null,
    lastModifiedAt: serverTimestamp()
  }, { merge: true });
}

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

export function isHouseholdMember(h: any, u: any) {
  if (!h || !u) return false;
  if (Array.isArray(h.memberIds) && h.memberIds.includes(u.id)) return true;
  if (Array.isArray(h.members)) {
    return h.members.some((m: any) => (m.id && m.id === u.id) || (m.email && m.email === u.email));
  }
  return false;
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
  const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
  
  // Clean the description by removing quantities and common descriptors
  let description = text
    // Remove quantities at the beginning
    .replace(/^\d+\s+/, '')
    // Remove common size descriptors
    .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
    // Keep colors for distinguishing items (like red vs green apples)
    // .replace(/\b(red|green|yellow|blue|black|white|brown|orange|purple|pink)\s+/g, '')
    // Remove common preparation descriptors that don't affect core item identity
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '')
    // Remove common quality descriptors
    .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '')
    // Remove trailing/leading whitespace
    .trim();
  
  // Capitalize first letter of each word for better display
  description = description.replace(/\b\w/g, l => l.toUpperCase());
  
  return { quantity, description };
}

/**
 * Parses ingredient text to extract quantity string and item name for shopping list
 * @param ingredientText Raw ingredient text (e.g., "1 cup flour", "2 tbsp sugar", "3 eggs")
 * @returns Object with quantity string and cleaned item name
 */
export function parseIngredientForShoppingList(ingredientText: string): { quantity: string; itemName: string } {
  const perfTrace = trace(performance, 'parse_ingredient_shopping_list');
  perfTrace.start();

  try {
    const text = ingredientText.trim();

    // Add custom metrics
    perfTrace.putMetric('input_length', text.length);

    // Match common quantity patterns at the beginning
    // This regex matches: number + optional fraction + unit (cup, tbsp, tsp, etc.) + optional "s"
    const quantityRegex = /^(\d+(?:\/\d+)?(?:\s*\d+\/\d+)?)\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|pound|lb|gram|g|kg|liter|l|ml|quart|qt|pint|pt|gallon|gal|can|bottle|package|pkg|box|bag|slice|piece|clove|head|stalk|bunch|sprig|dash|pinch)s?\b/i;

    const match = text.match(quantityRegex);
    let quantity = '';
    let itemName = text;

    if (match) {
      quantity = match[0].trim();
      itemName = text.substring(match[0].length).trim();
      perfTrace.putAttribute('parsing_method', 'regex_match');
    } else {
      // Fallback: try to match just a number at the beginning
      const numberMatch = text.match(/^(\d+(?:\/\d+)?)\s+/);
      if (numberMatch) {
        quantity = numberMatch[1];
        itemName = text.substring(numberMatch[0].length).trim();
        perfTrace.putAttribute('parsing_method', 'number_fallback');
      } else {
        perfTrace.putAttribute('parsing_method', 'no_quantity');
      }
    }

    // Clean the item name by removing common descriptors
    itemName = itemName
      // Remove common size descriptors
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/gi, '')
      // Keep colors for distinguishing items (like red vs green apples)
      // Remove common preparation descriptors that don't affect core item identity
      .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/gi, '')
      // Remove common quality descriptors
      .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/gi, '')
      // Remove trailing/leading whitespace
      .trim();

    // Capitalize first letter of each word for better display
    itemName = itemName.replace(/\b\w/g, l => l.toUpperCase());

    // If no quantity was found, set default to "1"
    if (!quantity) {
      quantity = '1';
    }

    // Add output metrics
    perfTrace.putMetric('output_quantity_length', quantity.length);
    perfTrace.putMetric('output_item_length', itemName.length);

    return { quantity, itemName };
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
    // Remove common size descriptors
    .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
    // Remove common color descriptors
    .replace(/\b(red|green|yellow|blue|black|white|brown|orange|purple|pink)\s+/g, '')
    // Remove common preparation descriptors that don't affect core item identity
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '')
    // Remove common quality descriptors
    .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '')
    // Remove trailing/leading whitespace
    .trim();

  // Capitalize first letter of each word for better display
  cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());

  return cleaned;
}

export function getItemImage(itemName: string, category: string): string {
  const name = itemName.toLowerCase();
  const cat = category.toLowerCase();

  // Clean the item name by removing quantities and common descriptors
  const cleanItemName = (itemName: string): string => {
    let cleaned = itemName.toLowerCase()
      // Remove quantities at the beginning (e.g., "1 ", "2 ", "3 ", etc.)
      .replace(/^\d+\s+/, '')
      // Remove common size descriptors
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/g, '')
      // Remove common color descriptors
      .replace(/\b(red|green|yellow|blue|black|white|brown|orange|purple|pink)\s+/g, '')
      // Remove common preparation descriptors that don't affect core item identity
      .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely)\s+/g, '')
      // Remove common quality descriptors
      .replace(/\b(ripe|raw|cooked|baked|fried|organic)\s+/g, '')
      // Remove trailing/leading whitespace
      .trim();

    return cleaned;
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

  // Priority function for image types: png > svg
  const getImagePriority = (image: string): number => {
    if (image.endsWith('.png')) return 2;
    if (image.endsWith('.svg')) return 1;
    return 0;
  };

  // Direct matches for item names - prefer thumb images, then webp, png, svg
  const itemMappings: Record<string, string> = {
    // Fruits
    'apple': 'apple.png',
    'apples': 'apples.png',
    'green apple': 'green_apple.png',
    'red apple': 'red_apple.png',
    'banana': 'banana.png',
    'bananas': 'banana.png',
    'orange': 'orange.png',
    'oranges': 'orange.png',
    'strawberry': 'strawberry.png',
    'strawberries': 'strawberry.png',
    'cherries': 'cherries.png',
    'cherry': 'cherry.svg',
    'grapes': 'grapes.svg',
    'grape': 'grapes.svg',
    'lemon': 'lemon.png',
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
    'egg': 'egg.png',

    // Meat & Poultry
    'sausage': 'sausage.png',
    'ham': 'ham.png',
    'pork': 'pork.png',
    'hot dog': 'hot_dog.png',
    'fried chicken': 'fried_chicken.png',

    // Seafood
    'salmon': 'salmon.svg',
    'baked salmon': 'baked_salmon.png',
    'crab': 'crab.svg',
    'lobster': 'lobster.svg',
    'steamed lobster': 'steamed_lobster.png',

    // Grains & Bread
    'muffin': 'muffin.png',

    // Condiments & Sauces
    'mayonnaise': 'mayonnaise.svg',
    'pickle': 'pickle.png',

    // Snacks & Nuts
    'almond': 'almond.png',
    'cashew nuts': 'cashew_nuts.png',
    'almond butter': 'almond-butter.svg',
    'popcorn': 'pop_corn.png',
    'walnut': 'walnut.png',

    // Beverages
    'tea bag': 'tea_bag.png',
    'apple juice': 'apple_juice.png',
    'scotch whisky': 'scotch_whisky.png',

    // Baking & Sweets
    'chocolate': 'chocolate-bar.svg',

    // Canned & Processed
    'tomato puree': 'tomato_puree.png',

    // Spices & Herbs
    'cinnamon': 'cinnamon-sticks.svg',

    // Other
    'parmesan': 'parmesan.svg',
    'salami': 'salami.svg',
    'whipped cream': 'whipped-cream.svg',
    'soy': 'soy.svg',

    // Thumb images (high priority)
    'milk': '1galmilk.png',
    '2% milk': '2percentmilk.png',
    'almond milk': 'almondmilk.png',
    'eggs': 'eggs.png',
    'bacon': 'bacon.png',
    'butter': 'buttersticks.png',
    'cheese': 'slicedcheese.png',
    'bread': 'wheatbread.png',
    'pasta': 'spaghetti.png',
    'angel hair': 'angelhairnoodles.png',
    'angel hair pasta': 'angelhairnoodles.png',
    'barilla angel hair': 'angelhairnoodles.png',
    'barilla elbows': 'elbownoodles.png',
    'elbows': 'elbownoodles.png',
    'elbow pasta': 'elbownoodles.png',
    'rotini': 'rotininoodles.png',
    'tri-color rotini': 'rotininoodles.png',
    'barilla tri-color rotini': 'rotininoodles.png',
    'barilla': 'spaghetti.png',
    'fettuccine': 'spaghetti.png',
    'penne': 'spaghetti.png',
    'rigatoni': 'spaghetti.png',
    'ravioli': 'spaghetti.png',
    'tortellini': 'spaghetti.png',
    'ramen': 'spaghetti.png',
    'udon': 'spaghetti.png',
    'chicken': 'frozenchicken.png',
    'beef': 'groundbeef.png',
    'fish': 'frozenfishfilet.png',
    'shrimp': 'frozenshrimp.png',
    'steak': 'steak.png',
    'ketchup': 'ketchup.png',
    'mustard': 'mustard.png',
    'mayo': 'mayo.png',
    'peanut butter': 'peanutbutter.png',
    'coffee': 'folgerscoffee.png',
    'ice cream': 'vanillaicecream.png',
    'cookies': 'cookiesncreamicecream.png',
    'soup': 'chickennoodlesoup.png',
    'oatmeal': 'quakeroats.png',
    'rice': 'rice.png',
    'flour': 'flour.png',
    'sugar': 'cakebox.png',
    'salt': 'saltseason.png',
    'pepper': 'blackpepperseason.png',
    'garlic': 'mincedgarlicseason.png',
    'onion': 'mincedonionseason.png',
    'oil': 'oilnvinegar.png',
    'vinegar': 'oilnvinegar.png',
    'sauce': 'spaghetti.png',
    'juice': 'applejuice.png',
    'beer': 'beer.png',
    'wine': 'oilnvinegar.png',
    'chips': 'doritos.png',
    'nuts': 'peanuts.png',
    'candy': 'mnms.png',
    'fruit': 'applejuice.png',
    'vegetable': 'cannedcarrots.png',
    'canned asparagus': 'cannedasparagus.png',
    'canned carrots': 'cannedcarrots.png',
    'canned collard greens': 'cannedcollardgreens.png',
    'canned corn': 'cannedcorn.png',
    'canned cream corn': 'cannedcreamcorn.png',
    'canned diced tomatoes': 'canneddicedtomatos.png',
    'canned field peas': 'cannedfielpeas.png',
    'canned french style green beans': 'cannedfrenchstylegreenbeans.png',
    'canned green beans': 'cannedgreenbeans.png',
    'canned lima beans': 'cannedlimabeans.png',
    'canned mixed vegetables': 'cannedmixedvegetables.png',
    'canned mushrooms': 'cannedmushrooms.png',
    'canned peas': 'cannedpeas.png',
    'canned peas and carrots': 'cannedpeasandcarrots.png',
    'canned potatoes': 'cannedpotatos.png',
    'canned ravioli': 'cannedravioli.png',
    'canned yams': 'cannedyams.png',
    'chicken noodle soup': 'chickennoodlesoup.png',
    'chicken nuggets': 'chickennuggets.png',
    'chicken patties': 'chickenpatties.png',
    'chili seasoning': 'chiliseaon.png',
    'chocolate cake': 'chocolatecake.png',
    'chocolate ice cream': 'chocolateicecream.png',
    'chocolate milk': 'chocolatemilk.png',
    'cocktail sauce': 'cocktailsauce.png',
    'coffee creamer': 'coffeecreamer.png',
    'condensed milk': 'condensedmilkcan.png',
    'cookie dough': 'cookiedough.png',
    'cookie dough ice cream': 'cookiedoughicecream.png',
    'cookies and cream ice cream': 'cookiesncreamicecream.png',
    'cream cheese': 'creamcheese.png',
    'cream of chicken soup': 'creamofchickensoup.png',
    'cream of mushroom soup': 'creamofmushroomsoup.png',
    'creole seasoning': 'creoleseason.png',
    'croissant': 'croissant.png',
    'cupcake': 'cupcake.png',
    'dinner rolls': 'dinnerrolls.png',
    'doritos': 'doritos.png',
    'easy spray cheese': 'easyspraycheese.png',
    'english muffin': 'englishmuffin.png',
    'evaporated milk': 'evaporatedmilk.png',
    'fettuccine noodles': 'fettuccinenoodles.png',
    'folgers coffee': 'folgerscoffee.png',
    'french onion soup': 'frenchonionsoup.png',
    'frozen chicken': 'frozenchicken.png',
    'frozen chicken breast': 'frozenchickenbreast.png',
    'frozen chicken tenderloins': 'frozenchickentenderloins.png',
    'frozen fish filet': 'frozenfishfilet.png',
    'frozen shrimp': 'frozenshrimp.png',
    'frozen steak': 'frozensteak.png',
    'garlic herb seasoning': 'garlicherbseason.png',
    'garlic powder': 'garlicpowder.png',
    'grape jelly': 'grapejelly.png',
    'grated parmesan cheese': 'gratedparmesancheese.png',
    'ground beef': 'groundbeef.png',
    'ground cinnamon': 'groundcinnamonseason.png',
    'half gallon whole milk': 'halfgallonwholemilk.png',
    'hamburger buns': 'hamburgerbuns.png',
    'hamburger helper': 'hamburgerhelper.png',
    'hamburger helper philly cheesesteak': 'hamburgerhelperphillycheesesteak.png',
    'honey mustard': 'honeymustard.png',
    'hot dogs': 'hotdogs.png',
    'hot sauce': 'hotsauce.png',
    'ice cream fudge bar': 'icecreamfudgebar.png',
    'ice cream sandwich': 'icecreamsandwich.png',
    'italian loaf bread': 'italianloafbread.png',
    'italian seasoning': 'itatlianseason.png',
    'kraft mac and cheese': 'kraftmacandcheese.png',
    'lasagna noodles': 'lasagnanoodles.png',
    'lemon pepper seasoning': 'lemonpepperseason.png',
    'minced garlic': 'mincedgarlicseason.png',
    'minced onion': 'mincedonionseason.png',
    'mint ice cream': 'minticecream.png',
    'm&ms': 'mnms.png',
    'parsley seasoning': 'parsleyseason.png',
    'paprika seasoning': 'paprikaseason.png',
    'penne noodles': 'pennenoodles.png',
    'pickles': 'pickles.png',
    'pinto beans': 'pintobeans.png',
    'progresso chicken noodle soup': 'progressochickennoodlesoup.png',
    'quaker oats': 'quakeroats.png',
    'ramen noodles': 'ramennoodles.png',
    'ranch dressing': 'ranchdressing.png',
    'relish': 'relish.png',
    'rigatoni noodles': 'rigatoninoodles.png',
    'rotini noodles': 'rotininoodles.png',
    'shell noodles': 'shellnoodles.png',
    'shells and cheese': 'shellsandcheese.png',
    'shredded cheddar cheese': 'shreddedcheddarcheese.png',
    'shredded parmesan': 'shreddedparmesan.png',
    'sriracha': 'siracha.png',
    'sliced cheese': 'slicedcheese.png',
    'sliced colby jack cheese': 'slicedcolbyjackcheese.png',
    'sliced pepper jack cheese': 'slicedpepperjackcheese.png',
    'sliced swiss cheese': 'slicedswisscheese.png',
    'sour cream': 'sourcream.png',
    'soy sauce': 'soysauce.png',
    'spaghetti sauce': 'spegheatisauce.png',
    'spicy mustard': 'spicymustard.png',
    'steak sauce': 'steaksauce.png',
    'string cheese': 'stringcheese.png',
    'taco seasoning': 'tacoseason.png',
    'tartar sauce': 'tartarsauce.png',
    'tomato soup': 'tomatosoup.png',
    'tortilla': 'tortilla.png',
    'wheat bread': 'wheatbread.png',
    'white bread': 'whitebread.png',
    'white round top bread': 'whiteroundtopbread.png',
    'whole pickles': 'wholepickles.png',
    'yum yum sauce': 'yumyumsauce.png'
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
    'fruit': 'fruits.png',
    'vegetable': 'carrot.svg',
    'dairy': 'cheese.png',
    'meat': 'beef.png',
    'seafood': 'lobster.svg',
    'pasta': 'spaghetti.png',
    'bakery': 'pasta.png',
    'condiments': 'ketchup.png',
    'spices': 'salt.png',
    'nuts': 'peanuts.png',
    'snacks': 'pop_corn.png',
    'beverages': 'coffee.png',
    'frozen': 'vanilla_ice_cream.png',
    'baking': 'flour.png',
    'breakfast': 'egg.png',
    'canned': 'tomato_puree.png'
  };

  for (const [key, image] of Object.entries(categoryMappings)) {
    if (normalizedCat.includes(key)) {
      return `/images/${image}`;
    }
  }

  // Default placeholder
  return '/images/placeholder.svg';
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

export function inferCategoryFromItemName(itemName: string): string {
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
 * Determines if an item should have an automatic expiration date and returns the date
 * @param itemName The name of the item
 * @param category The category of the item
 * @returns ISO date string (YYYY-MM-DD) for expiration, or undefined if no auto-expiration
 */
export function getAutoExpirationDate(itemName: string, category: string): string | undefined {
  const name = itemName.toLowerCase();
  const cat = category.toLowerCase();
  
  // Milk and dairy products get 10 days
  if (name.includes('milk') || cat === 'dairy') {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 10);
    return expirationDate.toISOString().slice(0, 10); // YYYY-MM-DD format
  }
  
  // Sour cream gets 3 weeks (21 days)
  if (name.includes('sour cream')) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 21);
    return expirationDate.toISOString().slice(0, 10); // YYYY-MM-DD format
  }
  
  // Could add more auto-expiration rules here for other items
  // if (name.includes('bread') || cat === 'bakery') {
  //   const expirationDate = new Date();
  //   expirationDate.setDate(expirationDate.getDate() + 3);
  //   return expirationDate.toISOString().slice(0, 10);
  // }
  
  return undefined;
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

  inventory.forEach(item => {
    if (!item.consumptionHistory || item.consumptionHistory.length < 2) {
      return; // Need at least 2 data points for patterns
    }

    const history = item.consumptionHistory
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());

    // Calculate average interval between purchases
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const days = Math.floor((history[i].getTime() - history[i - 1].getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0 && days < 90) { // Ignore intervals longer than 3 months
        intervals.push(days);
      }
    }

    if (intervals.length === 0) return;

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const lastPurchase = history[history.length - 1];
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
    if (!item.expirationDate) return;

    const expirationDate = new Date(item.expirationDate);
    const todayDate = new Date(today);
    const daysRemaining = Math.ceil((expirationDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    const expirationType = item.expirationType || 'best-by';
    let alertLevel: 'expired' | 'critical' | 'warning' | 'info';
    let message: string;

    // Special handling for milk - only warn when 3 days or less remain
    const isMilk = item.item.toLowerCase().includes('milk') || item.category.toLowerCase() === 'dairy';
    const warningThreshold = isMilk ? 3 : 7;

    if (daysRemaining < 0) {
      alertLevel = 'expired';
      message = `${item.item} has expired!`;
    } else if (daysRemaining === 0) {
      alertLevel = 'critical';
      message = `${item.item} expires today!`;
    } else if (daysRemaining <= 1) {
      alertLevel = 'critical';
      message = `${item.item} expires in ${daysRemaining} day!`;
    } else if (daysRemaining <= 3) {
      alertLevel = 'warning';
      message = `${item.item} expires in ${daysRemaining} days`;
    } else if (daysRemaining <= warningThreshold) {
      alertLevel = 'info';
      message = `${item.item} expires in ${daysRemaining} days`;
    } else {
      return; // No alert needed
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

    // Only suggest recipes for items expiring within 7 days
    if (daysRemaining < 0 || daysRemaining > 7) return;

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
export function getExpirationColor(daysRemaining: number, expirationType: 'use-by' | 'best-by' = 'best-by'): string {
  if (daysRemaining < 0) return 'text-red-600 bg-red-50 border-red-200'; // Expired
  if (daysRemaining === 0) return 'text-red-600 bg-red-50 border-red-200'; // Expires today
  if (daysRemaining <= 1) return 'text-red-600 bg-red-50 border-red-200'; // Critical (1 day)
  if (daysRemaining <= 3) return 'text-orange-600 bg-orange-50 border-orange-200'; // Warning (2-3 days)
  if (daysRemaining <= 7) return 'text-yellow-600 bg-yellow-50 border-yellow-200'; // Info (4-7 days)
  return 'text-green-600 bg-green-50 border-green-200'; // Good (>7 days)
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
    'Canned Goods'
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
    'Canned Goods': '🥫'
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
    'Canned Goods': '#607D8B'
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
const UNIT_CONVERSIONS = {
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
    const whole = parseInt(fractionMatch[1]);
    const numerator = parseInt(fractionMatch[2]);
    const denominator = parseInt(fractionMatch[3]);
    const decimal = whole + (numerator / denominator);
    processedText = text.replace(fractionMatch[0], decimal.toString());
  }

  // Handle simple fractions like "1/2"
  const simpleFractionRegex = /(\d+)\/(\d+)/;
  const simpleMatch = processedText.match(simpleFractionRegex);
  if (simpleMatch && !fractionMatch) {
    const numerator = parseInt(simpleMatch[1]);
    const denominator = parseInt(simpleMatch[2]);
    const decimal = numerator / denominator;
    processedText = processedText.replace(simpleMatch[0], decimal.toString());
  }

  // Extract number and unit
  const match = processedText.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (!match) {
    return null;
  }

  const amount = parseFloat(match[1]);
  const unit = match[2].trim();

  // Validate unit exists in our conversions
  if (!UNIT_CONVERSIONS[unit] && !UNIT_CONVERSIONS[unit + 's']) {
    return null;
  }

  return {
    amount,
    unit: UNIT_CONVERSIONS[unit] ? unit : unit + 's'
  };
}

/**
 * Convert quantity to normalized grams/ml for comparison
 */
export function normalizeQuantity(quantity: ParsedQuantity): QuantityResult {
  const conversionFactor = UNIT_CONVERSIONS[quantity.unit.toLowerCase()];
  if (!conversionFactor) {
    return { ...quantity };
  }

  // For weight/volume units, convert to grams/ml
  if (['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds'].includes(quantity.unit.toLowerCase())) {
    return {
      ...quantity,
      normalizedGrams: quantity.amount * conversionFactor
    };
  }

  if (['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'qt', 'quart', 'quarts', 'pt', 'pint', 'pints', 'gal', 'gallon', 'gallons'].includes(quantity.unit.toLowerCase())) {
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
    const amountInOriginalUnit = totalGrams / UNIT_CONVERSIONS[q1.unit.toLowerCase()];
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

    const amountInOriginalUnit = remainingGrams / UNIT_CONVERSIONS[total.unit.toLowerCase()];
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
 */
export function formatItemQuantity(item: PantryItem): string {
  if (item.quantity) {
    let amount = item.quantity.amount;
    const unit = item.quantity.unit;

    // Format common fractions nicely
    let displayAmount: string;
    if (amount === 0.25) displayAmount = '¼';
    else if (amount === 0.5) displayAmount = '½';
    else if (amount === 0.75) displayAmount = '¾';
    else displayAmount = amount.toString();

    return `${displayAmount} ${unit}`;
  }
  // Fallback to old system
  return item.quantity_estimate || '1';
}
