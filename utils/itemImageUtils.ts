import { itemImages, ITEM_IMAGE_CDN_BASE } from '../data/item-images';
import { cleanItemNameForShopping } from './ingredientParsingUtils';

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
    if (key.length >= 3 && (cleanedName.includes(key) || name.includes(key)) && key.length > bestKey.length) {
      bestKey = key;
    }
  }

  return bestKey ? itemImages[bestKey] : undefined;
}

const isFreshPepper = (name: string): boolean => {
  const low = name.toLowerCase();
  if (low === 'pepper' || low === 'peppers' || low === 'ground pepper' || low === 'cracked pepper') {
    return false;
  }
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
