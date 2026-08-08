import { CustomCategory } from '../types';

export function inferCategoryFromItemName(itemName: string | undefined): string {
  if (!itemName || typeof itemName !== 'string') return 'Other';
  const item = itemName.toLowerCase();

  // Leftovers
  if (item.includes('leftover')) return 'Leftovers';

  // Seafood (check specific fish names before generic meat/canned)
  if (item.includes('salmon') || item.includes('fish') || item.includes('shrimp') || item.includes('tuna') ||
      item.includes('crab') || item.includes('lobster') || item.includes('cod') || item.includes('tilapia') ||
      item.includes('scallop') || item.includes('oyster') || item.includes('clam') || item.includes('mussel') ||
      item.includes('halibut') || item.includes('haddock') || item.includes('sardine') || item.includes('anchovy') ||
      item.includes('trout') || item.includes('seafood') || item.includes('snapper') || item.includes('sea bass')) {
    return 'Seafood';
  }

  // Meat & Poultry (check meat types)
  if (item.includes('chicken') || item.includes('beef') || item.includes('pork') || item.includes('turkey') ||
      item.includes('bacon') || item.includes('sausage') || item.includes('steak') || item.includes('ham') ||
      item.includes('lamb') || item.includes('veal') || item.includes('mutton') || item.includes('meatball') ||
      item.includes('ribs') || item.includes('salami') || item.includes('pepperoni') || item.includes('hot dog') ||
      item.includes('frankfurter') || item.includes('duck') || item.includes('venison') || item.includes('meat') ||
      item.includes('prosciutto') || item.includes('bologna') || item.includes('chorizo') || item.includes('bratwurst')) {
    return 'Meat & Poultry';
  }

  // Dairy & Eggs
  if (item.includes('milk') || item.includes('cheese') || item.includes('yogurt') || item.includes('butter') ||
      item.includes('egg') || item.includes('cream') || item.includes('sour cream') || item.includes('cream cheese') ||
      item.includes('cottage cheese') || item.includes('half & half') || item.includes('whipped cream') ||
      item.includes('margarine') || item.includes('whey') || item.includes('ghee') || item.includes('provodone') ||
      item.includes('mozzarella') || item.includes('cheddar') || item.includes('parmesan') || item.includes('swiss cheese')) {
    return 'Dairy & Eggs';
  }

  // Specific produce (bell pepper, chili pepper, fresh garlic, fresh ginger) first to prevent getting miscategorized as spices
  if (item.includes('bell pepper') || item.includes('chili pepper') || item.includes('jalapeno') ||
      item.includes('habanero') || item.includes('poblano') || item.includes('sweet pepper') ||
      item.includes('serrano') || item.includes('cayenne pepper') ||
      (item.includes('garlic') && !item.includes('garlic powder') && !item.includes('garlic salt')) ||
      (item.includes('ginger') && !item.includes('ginger powder') && !item.includes('ground ginger')) ||
      item.includes('fresh herb') || item.includes('fresh basil') || item.includes('fresh parsley') ||
      item.includes('fresh cilantro') || item.includes('fresh thyme') || item.includes('fresh rosemary') ||
      item.includes('fresh oregano') || item.includes('fresh dill') || item.includes('fresh mint') ||
      item.includes('green onion') || item.includes('scallion') || item.includes('chive')) {
    return 'Fruits & Vegetables';
  }

  // Fruits
  if (item.includes('apple') || item.includes('banana') || item.includes('orange') || item.includes('grape') ||
      item.includes('strawberry') || item.includes('berry') || item.includes('blueberry') || item.includes('raspberry') ||
      item.includes('blackberry') || item.includes('lemon') || item.includes('lime') || item.includes('peach') ||
      item.includes('pear') || item.includes('plum') || item.includes('cherry') || item.includes('melon') ||
      item.includes('watermelon') || item.includes('avocado') || item.includes('mango') || item.includes('pineapple') ||
      item.includes('kiwi') || item.includes('apricot') || item.includes('fig') || item.includes('nectarine') ||
      item.includes('cantaloupe') || item.includes('pomegranate') || item.includes('grapefruit') || item.includes('mandarin') ||
      item.includes('clementine') || item.includes('papaya') || item.includes('coconut') || item.includes('cranberry') ||
      item.includes('raisin') || item.includes('date') || item.includes('prune') || item.includes('fruit')) {
    return 'Fruits & Vegetables';
  }

  // Vegetables
  if (item.includes('carrot') || item.includes('potato') || item.includes('onion') || item.includes('broccoli') ||
      item.includes('spinach') || item.includes('lettuce') || item.includes('tomato') || item.includes('celery') ||
      item.includes('cucumber') || item.includes('cabbage') || item.includes('zucchini') || item.includes('squash') ||
      item.includes('asparagus') || item.includes('mushroom') || item.includes('cauliflower') || item.includes('corn') ||
      item.includes('pea') || item.includes('green bean') || item.includes('kale') || item.includes('radish') ||
      item.includes('beet') || item.includes('eggplant') || item.includes('brussels sprout') || item.includes('sweet potato') ||
      item.includes('yam') || item.includes('shallot') || item.includes('leek') || item.includes('okra') ||
      item.includes('artichoke') || item.includes('turnip') || item.includes('parsnip') || item.includes('pumpkin') ||
      item.includes('vegetable') || item.includes('salad') || item.includes('greens') || item.includes('sprout')) {
    return 'Fruits & Vegetables';
  }

  // Breakfast Foods
  if (item.includes('waffle') || item.includes('pancake') || item.includes('oatmeal') ||
      item.includes('hash brown') || item.includes('granola') || item.includes('maple syrup') ||
      item.includes('muesli') || item.includes('bagel') || item.includes('pop-tart') ||
      item.includes('cereal') || item.includes('french toast') || item.includes('crepe')) {
    return 'Breakfast Foods';
  }

  // Pasta & Noodles
  if (item.includes('pasta') || item.includes('noodle') || item.includes('spaghetti') || item.includes('macaroni') ||
      item.includes('lasagna') || item.includes('ravioli') || item.includes('tortellini') || item.includes('ramen') ||
      item.includes('udon') || item.includes('soba') || item.includes('rice noodle') || item.includes('fettuccine') ||
      item.includes('penne') || item.includes('rotini') || item.includes('linguine') || item.includes('orzo') ||
      item.includes('couscous') || item.includes('rigatoni') || item.includes('gnocchi')) {
    return 'Pasta & Noodles';
  }

  // Grains & Bread
  if (item.includes('bread') || item.includes('rice') || item.includes('flour') ||
      item.includes('oat') || item.includes('quinoa') || item.includes('barley') || item.includes('tortilla') ||
      item.includes('wrap') || item.includes('croissant') || item.includes('bun') || item.includes('roll') ||
      item.includes('pita') || item.includes('naan') || item.includes('toast') || item.includes('wheat') ||
      item.includes('rye') || item.includes('grain') || item.includes('millet') || item.includes('baguette') ||
      item.includes('pita bread') || item.includes('english muffin') || item.includes('sourdough')) {
    return 'Grains & Bread';
  }

  // Condiments & Sauces
  if (item.includes('ketchup') || item.includes('mustard') || item.includes('mayo') || item.includes('mayonnaise') ||
      item.includes('sauce') || item.includes('oil') || item.includes('vinegar') || item.includes('barbecue') ||
      item.includes('bbq') || item.includes('soy sauce') || item.includes('hot sauce') || item.includes('salad dressing') ||
      item.includes('honey') || item.includes('syrup') || item.includes('jam') || item.includes('jelly') ||
      item.includes('peanut butter') || item.includes('almond butter') || item.includes('hummus') || item.includes('pesto') ||
      item.includes('salsa') || item.includes('guacamole') || item.includes('marinade') || item.includes('dip') ||
      item.includes('relish') || item.includes('spread') || item.includes('gravy') || item.includes('vinaigrette') ||
      item.includes('sriracha') || item.includes('teriyaki') || item.includes('pesto') || item.includes('tahini')) {
    return 'Condiments & Sauces';
  }

  // Spices & Herbs
  if (item.includes('salt') || item.includes('pepper') || item.includes('garlic') || item.includes('spice') ||
      item.includes('herb') || item.includes('cumin') || item.includes('paprika') || item.includes('oregano') ||
      item.includes('basil') || item.includes('thyme') || item.includes('rosemary') || item.includes('cinnamon') ||
      item.includes('nutmeg') || item.includes('curry') || item.includes('chili powder') || item.includes('seasoning') ||
      item.includes('rub') || item.includes('parsley') || item.includes('cilantro') || item.includes('sage') ||
      item.includes('dill') || item.includes('clove') || item.includes('seasoned') || item.includes('cardamom') ||
      item.includes('coriander') || item.includes('tumeric') || item.includes('ginger powder') ||
      item.includes('vanilla extract') || item.includes('allspice') || item.includes('cayenne') ||
      item.includes('bay leaf') || item.includes('bay leaves') || item.includes('saffron') ||
      item.includes('onion powder') || item.includes('garlic powder') || item.includes('garlic salt')) {
    return 'Spices & Herbs';
  }

  // Snacks
  if (item.includes('chip') || item.includes('cookie') || item.includes('cracker') || item.includes('candy') ||
      item.includes('peanut') || item.includes('almond') || item.includes('nut') || item.includes('popcorn') ||
      item.includes('pretzel') || item.includes('jerky') || item.includes('chocolate bar') || item.includes('gummy') ||
      item.includes('snack') || item.includes('cashew') || item.includes('pistachio') || item.includes('walnut') ||
      item.includes('pecan') || item.includes('hazelnut') || item.includes('trail mix') || item.includes('raisin') ||
      item.includes('donut') || item.includes('pastry') || item.includes('bars') || item.includes('seeds')) {
    return 'Snacks';
  }

  // Beverages
  if (item.includes('soda') || item.includes('juice') || item.includes('coffee') || item.includes('tea') ||
      item.includes('water') || item.includes('beer') || item.includes('wine') || item.includes('milkshake') ||
      item.includes('cider') || item.includes('smoothie') || item.includes('drink') || item.includes('beverage') ||
      item.includes('coca-cola') || item.includes('pepsi') || item.includes('sprite') || item.includes('seltzer') ||
      item.includes('ale') || item.includes('lager') || item.includes('rum') || item.includes('vodka') ||
      item.includes('whiskey') || item.includes('tonic') || item.includes('club soda') || item.includes('kombucha')) {
    return 'Beverages';
  }

  // Frozen Foods (check after meat/veggies since frozen meat goes to Meat, etc.)
  if (item.includes('frozen') || item.includes('ice cream') || item.includes('pizza') ||
      item.includes('tater tots') || item.includes('sorbet') || item.includes('gelato') ||
      item.includes('frozen meal') || item.includes('frozen dinner') || item.includes('popsicle') ||
      item.includes('frozen food') || item.includes('sherbet')) {
    return 'Frozen Foods';
  }

  // Baking Supplies
  if (item.includes('sugar') || item.includes('baking') || item.includes('vanilla') || item.includes('chocolate') ||
      item.includes('cocoa') || item.includes('yeast') || item.includes('baking powder') || item.includes('baking soda') ||
      item.includes('extract') || item.includes('sprinkles') || item.includes('frosting') || item.includes('icing') ||
      item.includes('chocolate chip') || item.includes('sprinkle') || item.includes('shortening') ||
      item.includes('molasses') || item.includes('cornstarch') || item.includes('marshmallow')) {
    return 'Baking Supplies';
  }

  // Canned Goods
  if (item.includes('canned') || item.includes('can ') || item.includes('soup') || item.includes('bean') ||
      item.includes('broth') || item.includes('stock') || item.includes('canned tomato') || item.includes('chili') ||
      item.includes('paste') || item.includes('bouillon') || item.includes('lentil') || item.includes('chickpea')) {
    return 'Canned Goods';
  }

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
