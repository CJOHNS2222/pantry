import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Raw items and prices from screenshots
const items = [
  // Produce
  { name: 'bananas', price: 0.66, unit: '1 lb' },
  { name: 'gala apples', price: 1.99, unit: '1 lb' },
  { name: 'strawberries', price: 2.65, unit: '16 oz clamshell' },
  { name: 'navel oranges', price: 1.60, unit: '1 lb' },
  { name: 'red grapes', price: 2.85, unit: '1 lb' },
  { name: 'lemons', price: 0.65, unit: 'each' },
  { name: 'limes', price: 0.45, unit: 'each' },
  { name: 'hass avocados', price: 1.25, unit: 'each' },
  { name: 'blueberries', price: 3.49, unit: '6 oz pint' },
  { name: 'russet potatoes', price: 0.85, unit: '1 lb' },
  { name: 'yellow onions', price: 0.99, unit: '1 lb' },
  { name: 'roma tomatoes', price: 1.90, unit: '1 lb' },
  { name: 'iceberg lettuce', price: 1.89, unit: 'head' },
  { name: 'broccoli crowns', price: 1.95, unit: '1 lb' },
  { name: 'whole carrots', price: 1.15, unit: '1 lb bag' },
  { name: 'celery', price: 1.75, unit: 'bunch' },
  { name: 'garlic', price: 0.75, unit: 'bulb' },
  { name: 'green bell peppers', price: 0.89, unit: 'each' },
  { name: 'red bell peppers', price: 1.49, unit: 'each' },
  { name: 'cucumbers', price: 0.79, unit: 'each' },
  { name: 'zucchini', price: 1.65, unit: '1 lb' },
  { name: 'fresh spinach', price: 2.99, unit: '8 oz bag' },
  { name: 'asparagus', price: 3.49, unit: '1 lb bunch' },
  { name: 'sweet potatoes', price: 1.10, unit: '1 lb' },
  { name: 'white mushrooms', price: 2.29, unit: '8 oz whole' },

  // Poultry & Seafood
  { name: 'ground beef (80/20)', price: 6.80, unit: '1 lb' },
  { name: 'chicken breasts (boneless/skinless)', price: 4.17, unit: '1 lb' },
  { name: 'chicken thighs (bone-in)', price: 2.49, unit: '1 lb' },
  { name: 'whole chicken', price: 1.89, unit: '1 lb' },
  { name: 'pork chops (bone-in)', price: 4.15, unit: '1 lb' },
  { name: 'pork bacon', price: 6.49, unit: '16 oz pack' },
  { name: 'ribeye steak', price: 14.99, unit: '1 lb' },
  { name: 'atlantic salmon fillet', price: 11.99, unit: '1 lb' },
  { name: 'raw shrimp (frozen, peeled)', price: 8.99, unit: '1 lb' },
  { name: 'canned tuna (in water)', price: 1.35, unit: '5 oz can' },
  { name: 'deli turkey slices', price: 8.99, unit: '1 lb' },
  { name: 'deli ham slices', price: 7.99, unit: '1 lb' },
  { name: 'italian sausage links', price: 5.49, unit: '19 oz pack' },
  { name: 'rotisserie chicken', price: 7.99, unit: 'whole (cooked)' },
  { name: 'ground turkey', price: 4.59, unit: '1 lb' },

  // Dairy & Eggs
  { name: 'whole milk', price: 4.07, unit: '1 gallon' },
  { name: '2% milk', price: 3.96, unit: '1 gallon' },
  { name: 'large white eggs', price: 2.45, unit: '1 dozen' },
  { name: 'unsalted butter', price: 4.49, unit: '16 oz (4 sticks)' },
  { name: 'cheddar cheese', price: 2.75, unit: '8 oz block' },
  { name: 'shredded mozzarella', price: 2.69, unit: '8 oz bag' },
  { name: 'cream cheese', price: 2.59, unit: '8 oz block' },
  { name: 'sour cream', price: 2.39, unit: '16 oz tub' },
  { name: 'plain greek yogurt', price: 4.89, unit: '32 oz tub' },
  { name: 'single-serve fruit yogurt', price: 0.85, unit: '6 oz cup' },
  { name: 'cottage cheese', price: 2.99, unit: '16 oz tub' },
  { name: 'heavy whipping cream', price: 3.29, unit: '16 oz carton' },
  { name: 'almond milk (unsweetened)', price: 3.49, unit: '64 oz carton' },

  // Bakery & Bread
  { name: 'white bread', price: 1.85, unit: '20 oz loaf' },
  { name: 'whole wheat bread', price: 2.69, unit: '20 oz loaf' },
  { name: 'hamburger buns', price: 2.53, unit: '8 count pack' },
  { name: 'hot dog buns', price: 2.39, unit: '8 count pack' },
  { name: 'flour tortillas', price: 2.49, unit: '10 count pack' },
  { name: 'plain bagels', price: 4.29, unit: '6 count pack' },
  { name: 'english muffins', price: 2.99, unit: '6 count pack' },
  { name: 'chocolate chip cookies', price: 4.25, unit: '13 oz package' },
  { name: 'dinner rolls', price: 3.29, unit: '12 count pack' },

  // Pantry Staples & Dry Goods
  { name: 'all-purpose flour', price: 3.89, unit: '5 lb bag' },
  { name: 'granulated white sugar', price: 3.69, unit: '4 lb bag' },
  { name: 'long-grain white rice', price: 1.06, unit: '1 lb bag' },
  { name: 'spaghetti pasta', price: 1.32, unit: '16 oz box' },
  { name: 'olive oil (extra virgin)', price: 8.49, unit: '16.9 oz bottle' },
  { name: 'vegetable oil', price: 4.39, unit: '48 oz bottle' },
  { name: 'creamy peanut butter', price: 2.89, unit: '16 oz jar' },
  { name: 'strawberry jam', price: 3.29, unit: '18 oz jar' },
  { name: 'canned tomato sauce', price: 0.65, unit: '8 oz can' },
  { name: 'canned diced tomatoes', price: 1.25, unit: '14.5 oz can' },
  { name: 'canned black beans', price: 0.99, unit: '15 oz can' },
  { name: 'canned sweet corn', price: 1.10, unit: '15.25 oz can' },
  { name: 'pork and beans', price: 3.06, unit: '32 oz can' },
  { name: 'mayonnaise', price: 4.99, unit: '30 oz jar' },
  { name: 'tomato ketchup', price: 2.79, unit: '20 oz bottle' },
  { name: 'yellow mustard', price: 1.89, unit: '14 oz bottle' },
  { name: 'table salt', price: 1.19, unit: '26 oz canister' },
  { name: 'ground black pepper', price: 3.89, unit: '3 oz tin' },
  { name: 'rolled oats', price: 2.99, unit: '18 oz canister' },
  // New expansion items from image (Items 101-200)
  // Produce (Expanded)
  { name: 'raspberries', price: 3.49, unit: '6 oz clamshell' },
  { name: 'blackberries', price: 3.29, unit: '6 oz clamshell' },
  { name: 'honeycrisp apples', price: 2.49, unit: '1 lb' },
  { name: 'kiwi', price: 2.49, unit: 'pack of 4' },
  { name: 'green onions (scallions)', price: 0.89, unit: 'bunch' },
  { name: 'fresh cilantro', price: 0.89, unit: 'bunch' },
  { name: 'fresh parsley', price: 0.89, unit: 'bunch' },
  { name: 'brussels sprouts', price: 2.99, unit: '1 lb' },
  { name: 'cauliflower', price: 3.29, unit: 'head' },
  { name: 'green cabbage', price: 0.89, unit: '1 lb' },
  { name: 'red radish', price: 1.15, unit: 'bunch' },
  { name: 'jalapeno peppers', price: 1.89, unit: '1 lb' },
  { name: 'sweet corn', price: 0.50, unit: 'per ear' },
  { name: 'fresh ginger root', price: 3.99, unit: '1 lb' },
  { name: 'portobello mushrooms', price: 3.49, unit: '6 oz pack' },
  { name: 'radishes', price: 1.15, unit: 'bunch' },
  { name: 'butternut squash', price: 1.29, unit: '1 lb' },

  // Meat, Poultry & Plant-Based Proteins
  { name: 'beef flank steak', price: 11.99, unit: '1 lb' },
  { name: 'beef sirloin steak', price: 9.49, unit: '1 lb' },
  { name: 'ground pork', price: 3.99, unit: '1 lb' },
  { name: 'chicken wings', price: 3.49, unit: '1 lb' },
  { name: 'turkey bacon', price: 4.99, unit: '12 oz pack' },
  { name: 'tilapia fillets', price: 5.99, unit: '1 lb (frozen)' },
  { name: 'cod fillets', price: 10.99, unit: '1 lb (frozen)' },
  { name: 'canned pink salmon', price: 4.49, unit: '14.75 oz can' },
  { name: 'firm tofu', price: 2.49, unit: '14 oz block' },
  { name: 'plant-based burger patties', price: 5.49, unit: '8 oz (2 pack)' },
  { name: 'cornish game hen', price: 4.99, unit: 'each' },
  { name: 'lamb chops', price: 15.99, unit: '1 lb' },
  { name: 'prosciutto slices', price: 4.99, unit: '3 oz pack' },
  { name: 'deli salami slices', price: 4.49, unit: '8 oz pack' },
  { name: 'grass-fed beef', price: 8.79, unit: '1 lb' },

  // Dairy & Dairy Alternatives (Expanded)
  { name: 'soy milk', price: 3.89, unit: '0.5 gallon' },
  { name: 'oat milk', price: 4.19, unit: '64 oz carton' },
  { name: 'coconut milk (beverage)', price: 3.99, unit: '64 oz carton' },
  { name: 'salted butter', price: 4.49, unit: '16 oz (4 sticks)' },
  { name: 'parmesan cheese wedge', price: 5.49, unit: 'each' },
  { name: 'goat cheese log', price: 3.99, unit: '4 oz block' },
  { name: 'feta cheese crumbles', price: 3.89, unit: '6 oz tub' },
  { name: 'swiss cheese slices', price: 3.49, unit: '8 oz pack' },
  { name: 'provolone cheese slices', price: 3.29, unit: '8 oz pack' },
  { name: 'pepper jack cheese block', price: 2.75, unit: '8 oz block' },
  { name: 'ricotta cheese', price: 3.49, unit: '15 oz tub' },
  { name: 'dairy-free cheese', price: 4.19, unit: '8 oz bag' },
  { name: 'whipped cream aerosol', price: 2.89, unit: '6.5 oz can' },
  { name: 'margarine tub spread', price: 2.75, unit: '15 oz tub' },
  { name: 'organic large brown eggs', price: 4.99, unit: '1 dozen' },

  // Baking, Condiments & Pantry Additions
  { name: 'light brown sugar', price: 2.29, unit: '2 lb bag' },
  { name: 'powdered sugar', price: 2.29, unit: '2 lb bag' },
  { name: 'baking soda', price: 0.99, unit: '16 oz box' },
  { name: 'baking powder', price: 2.49, unit: '8.1 oz canister' },
  { name: 'pure vanilla extract', price: 9.99, unit: '2 oz bottle' },
  { name: 'unsweetened cocoa powder', price: 3.75, unit: '8 oz tub' },
  { name: 'soy sauce', price: 2.69, unit: '15 oz bottle' },
  { name: 'sriracha hot sauce', price: 4.99, unit: '17 oz bottle' },
  { name: 'bbq sauce', price: 2.29, unit: '18 oz bottle' },
  { name: 'balsamic vinegar', price: 4.50, unit: '16.9 oz bottle' },
  { name: 'apple cider vinegar', price: 3.49, unit: '32 oz bottle' },
  { name: 'white distilled vinegar', price: 2.29, unit: '64 oz' },
  { name: 'canola oil', price: 3.99, unit: '48 oz bottle' },
  { name: 'olive oil', price: 7.99, unit: '16.9 oz bottle' },
  { name: 'canned chickpeas (garbanzo)', price: 0.99, unit: '15 oz can' },
  { name: 'canned cannellini (white bean)', price: 1.15, unit: '15.5 oz can' },
  { name: 'garlic powder', price: 1.75, unit: '3.12 oz spice jar' },
  { name: 'onion powder', price: 1.75, unit: '3 oz spice jar' },
  { name: 'chili powder', price: 1.75, unit: '2.5 oz spice jar' },
  { name: 'ground cinnamon', price: 1.89, unit: '2.37 oz spice jar' },
  { name: 'oregano leaves', price: 1.89, unit: '0.75 oz spice jar' },

  // Frozen & Convenience Expansion
  { name: 'frozen potstickers / dumplings', price: 4.99, unit: '16 oz bag' },
  { name: 'frozen breakfast sandwiches', price: 5.49, unit: '4 count box' },
  { name: 'frozen whole strawberries', price: 3.49, unit: '16 oz bag' },
  { name: 'frozen peas & carrots', price: 1.25, unit: '12 oz bag' },
  { name: 'frozen sweet corn', price: 1.25, unit: '12 oz bag' },
  { name: 'frozen broccoli florets', price: 1.49, unit: '12 oz bag' },
  { name: 'frozen chicken nuggets', price: 6.99, unit: '32 oz bag' },
  { name: 'frozen hash brown patties', price: 3.29, unit: '10 count box' },
  { name: 'frozen garlic bread', price: 2.99, unit: '16 oz box (2ct)' },
  { name: 'frozen breaded fish sticks', price: 5.99, unit: '24 oz box' },

  // Snacks, Treats & Quick Meals
  { name: 'raw whole almonds', price: 6.99, unit: '16 oz bag' },
  { name: 'halves & pieces walnuts', price: 5.99, unit: '16 oz bag' },
  { name: 'dry roasted peanuts', price: 2.49, unit: '16 oz jar' },
  { name: 'pita crackers', price: 3.29, unit: '5.3 oz box' },
  { name: 'honey graham crackers', price: 3.69, unit: '14.4 oz box' },
  { name: 'instant mac & cheese cup', price: 1.25, unit: 'single (2.05 oz) cup' },
  { name: 'instant ramen noodles', price: 3.49, unit: '12 pack box' },
  { name: 'gummy bear candy', price: 1.99, unit: '8 oz bag' },
  { name: 'jelly bean candy', price: 2.75, unit: '14 oz bag' },
  { name: 'milk chocolate candy bar', price: 1.25, unit: 'standard (1.55 oz) bar' },

  // Extended Beverages & Baking Inclusions
  { name: 'cranberry juice cocktail', price: 3.49, unit: '64 oz bottle' },
  { name: 'tomato juice', price: 1.89, unit: '46 oz can' },
  { name: 'flavored seltzer water', price: 4.89, unit: '12 pack (12 oz cans)' },
  { name: 'ginger ale soda', price: 7.99, unit: '12 pack (12 oz cans)' },
  { name: 'club soda', price: 1.49, unit: '1 Liter bottle' },
  { name: 'tonic water', price: 1.49, unit: '1 Liter bottle' },
  { name: 'decaf espresso pods', price: 6.99, unit: '10 count pack' },
  { name: 'hot cocoa mix envelopes', price: 2.89, unit: '10 count box' },
  { name: 'semi-sweet chocolate chips', price: 2.79, unit: '12 oz bag' },
  { name: 'mini marshmallows', price: 1.49, unit: '10 oz bag' },

  // Items 201-300
  // Grains, Baking & International Foundations
  { name: 'quinoa', price: 3.99, unit: '16 oz bag' },
  { name: 'brown rice', price: 2.19, unit: '2 lb bag' },
  { name: 'jasmine rice', price: 6.29, unit: '5 lb bag' },
  { name: 'panko breadcrumbs', price: 2.49, unit: '8 oz box' },
  { name: 'yellow cornmeal', price: 2.29, unit: '24 oz bag' },
  { name: 'active dry yeast', price: 2.29, unit: '3-pack strip (0.75 oz)' },
  { name: 'coconut milk (canned)', price: 1.89, unit: '13.5 oz can' },
  { name: 'rice vinegar', price: 2.49, unit: '10 oz bottle' },
  { name: 'pure sesame oil', price: 3.89, unit: '5 oz bottle' },
  { name: 'premium fish sauce', price: 2.99, unit: '6.7 oz bottle' },
  { name: 'hoisin sauce', price: 3.49, unit: '15 oz bottle' },
  { name: 'traditional rolled barley', price: 1.99, unit: '16 oz bag' },
  { name: 'diced green chilies', price: 0.89, unit: '4 oz can' },
  { name: 'red enchilada sauce', price: 1.89, unit: '10 oz can' },
  { name: 'gluten-free flour', price: 4.49, unit: '22 oz bag' },

  // Condiments, Dressings & Sauces
  { name: 'ranch dressing', price: 3.49, unit: '16 oz bottle' },
  { name: 'italian dressing', price: 2.89, unit: '16 oz bottle' },
  { name: 'creamy caesar dressing', price: 3.49, unit: '16 oz bottle' },
  { name: 'balsamic vinaigrette', price: 3.79, unit: '16 oz bottle' },
  { name: 'sweet & sour sauce', price: 2.29, unit: '12 oz bottle' },
  { name: 'kosher dill pickle spears', price: 3.29, unit: '24 oz jar' },
  { name: 'sweet relish', price: 2.49, unit: '12 oz squeeze' },
  { name: 'pitted black olives', price: 1.89, unit: '6 oz can' },
  { name: 'green olives (stuffed)', price: 2.29, unit: '5.75 oz jar' },
  { name: 'capers (in brine)', price: 2.49, unit: '3.5 oz jar' },
  { name: 'basil pesto sauce', price: 3.89, unit: '6.7 oz jar' },
  { name: 'creamy alfredo sauce', price: 3.49, unit: '15 oz jar' },
  { name: 'worcestershire sauce', price: 2.89, unit: '10 oz bottle' },
  { name: 'hot sauce (cayenne)', price: 3.79, unit: '12 oz bottle' },
  { name: 'pizza sauce', price: 1.99, unit: '14 oz jar' },

  // Cheese & Deli Specialties
  { name: 'blue cheese crumbles', price: 3.89, unit: '5 oz tub' },
  { name: 'fresh mozzarella ball', price: 3.99, unit: '8 oz' },
  { name: 'brie cheese wheel', price: 5.49, unit: '8 oz' },
  { name: 'low-moisture string cheese', price: 3.89, unit: '12 count pack' },
  { name: 'sharp cheddar block', price: 2.89, unit: '8 oz block' },
  { name: 'deli American cheese', price: 3.89, unit: '12 oz (16 slices)' },
  { name: 'classic hummus', price: 3.49, unit: '10 oz tub' },
  { name: 'fresh basil', price: 2.29, unit: '0.75 oz' },
  { name: 'pimento cheese spread', price: 3.79, unit: '12 oz tub' },
  { name: 'smoked ham slices', price: 6.99, unit: '1 lb tub' },
  { name: 'southern style potato salad', price: 3.49, unit: '16 oz tub' },
  { name: 'creamy cole slaw', price: 2.99, unit: '16 oz tub' },
  { name: 'rotisserie chicken', price: 7.99, unit: 'whole (cooked)' },
  { name: 'grass-fed butter', price: 3.89, unit: '8 oz' },

  // Frozen Meals & Sides
  { name: 'frozen family size lasagna', price: 8.49, unit: '34 oz box' },
  { name: 'frozen chicken pot pie', price: 1.49, unit: 'single (7 oz)' },
  { name: 'frozen garlic breadsticks', price: 2.89, unit: '6 count box' },
  { name: 'frozen mozzarella sticks', price: 4.49, unit: '11 oz bag' },
  { name: 'frozen tater tots', price: 3.49, unit: '32 oz bag' },
  { name: 'frozen battered onion rings', price: 3.89, unit: '16 oz bag' },
  { name: 'frozen sweet potato fries', price: 3.99, unit: '20 oz bag' },
  { name: 'frozen chopped spinach', price: 1.25, unit: '10 oz microwave bag' },
  { name: 'frozen sweet peas & carrots', price: 1.49, unit: '12 oz bag' },
  { name: 'frozen breakfast hashbrowns', price: 3.29, unit: '30 oz bag' },
  { name: 'frozen blueberry waffles', price: 2.89, unit: '10 count box' },
  { name: 'frozen breakfast burritos', price: 6.49, unit: '8 count box' },
  { name: 'ice cream bars (chocolate coated)', price: 4.49, unit: '6 count box' },
  { name: 'frozen triple berry smoothie mix', price: 7.99, unit: '48 oz bag' },
  { name: 'frozen rainbow sherbet', price: 3.49, unit: '48 oz tub' },

  // Expanded Beverages
  { name: 'premium sparkling water', price: 3.99, unit: '8 pack (12 oz cans)' },
  { name: 'sugar-free energy drink', price: 2.49, unit: 'single (16 oz can)' },
  { name: 'electrolyte sports drink', price: 1.49, unit: '32 oz bottle' },
  { name: 'diet cola soda', price: 7.99, unit: '12 pack (12 oz cans)' },
  { name: 'lemon lime soda', price: 7.99, unit: '12 pack (12 oz cans)' },
  { name: 'old fashioned root beer', price: 2.19, unit: '2 Liter bottle' },
  { name: 'chilled sweetened iced tea', price: 3.29, unit: 'gallon jug' },
  { name: 'unsweetened cold brew coffee', price: 5.49, unit: '48 oz bottle' },
  { name: 'single-serve coffee pods', price: 7.99, unit: '12 count box' },
  { name: 'whole coffee beans', price: 8.49, unit: '12 oz bag' },
  { name: 'pure green tea', price: 2.49, unit: '20 count box' },
  { name: 'lemonade bottle', price: 2.89, unit: '59 oz bottle' },
  { name: '100% grapefruit juice', price: 4.29, unit: '59 oz bottle' },
  { name: 'peach nectar', price: 2.69, unit: '33.8 oz carton' },
  { name: 'pure coconut water', price: 3.89, unit: '33.8 oz carton' },

  // Household & Paper Staples
  { name: 'double-roll paper towels', price: 8.99, unit: '6 count pack' },
  { name: 'ultra soft bath tissue', price: 11.49, unit: '12 mega rolls' },
  { name: 'facial tissues', price: 4.99, unit: '3-pack box' },
  { name: '13-gallon drawstring trash bags', price: 8.99, unit: '40 count box' },
  { name: 'ultra liquid dish soap', price: 3.99, unit: '32.5 oz bottle' },
  { name: 'dishwasher detergent actionpacs', price: 5.99, unit: '24 count tub' },
  { name: 'liquid laundry detergent (original)', price: 12.99, unit: '92 oz bottle' },
  { name: 'fabric softener sheets', price: 5.49, unit: '120 count box' },
  { name: 'clinging bleach toilet bowl gel', price: 2.69, unit: '24 oz bottle' },
  { name: 'disinfecting wipes', price: 4.89, unit: '75 count canister' },
  { name: 'multi-surface cleaner spray', price: 3.89, unit: '32 oz spray bottle' },
  { name: 'standard aluminum foil', price: 3.29, unit: '75 sq ft roll' },
  { name: 'plastic food wrap', price: 2.59, unit: '200 sq ft roll' },
  { name: 'zipper sandwich bags', price: 3.29, unit: '90 count box' },
  { name: 'zipper freezer bags (gallon)', price: 4.19, unit: '30 count box' },

  // Cereals, Breakfast & Simple Grains
  { name: 'honey nut toasted oats cereal', price: 4.79, unit: '15.4 oz box' },
  { name: 'frosted flakes cereal', price: 4.49, unit: '13.5 oz box' },
  { name: 'maple brown sugar oatmeal packets', price: 3.49, unit: '10 count box' },
  { name: 'complete pancake & waffle mix', price: 2.89, unit: '32 oz box' },
  { name: 'frosted strawberry pop-tarts', price: 3.29, unit: '8 count box' },
  { name: 'instant grits', price: 3.29, unit: '12 count box' },
  { name: 'steel cut oats', price: 3.89, unit: '30 oz canister' },
  { name: 'old fashioned rolled oats', price: 4.89, unit: '42 oz canister' },
  { name: 'yellow corn tortillas', price: 2.89, unit: '80 ct bag' },
  { name: 'original wheat crackers', price: 3.29, unit: '9 oz box' }
];

async function main() {
  console.log('🛒 Seeding Price Cache in Firestore...');
  
  // Load service account key
  const serviceAccountPath = path.join(__dirname, 'ornate-compass-478504-e1-firebase-adminsdk-fbsvc-b421e3c5e1.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  // Initialize Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const docRef = db.doc('price_cache/priceData');

  // Convert the items array into the PriceDataCache map format
  const priceDataMap = {};
  const now = new Date();

  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    priceDataMap[key] = {
      averagePrice: item.price,
      minPrice: Number((item.price * 0.85).toFixed(2)),
      maxPrice: Number((item.price * 1.15).toFixed(2)),
      sampleSize: 10,
      lastUpdated: now,
      unit: item.unit
    };
  }

  try {
    // Get existing data if any to merge
    const docSnap = await docRef.get();
    let mergedData = { ...priceDataMap };
    
    if (docSnap.exists) {
      const existingData = docSnap.data();
      console.log(`Found ${Object.keys(existingData).length} existing price cache entries.`);
      mergedData = {
        ...existingData,
        ...priceDataMap
      };
    }

    // Write to Firestore
    await docRef.set(mergedData);
    console.log(`✅ Successfully seeded ${Object.keys(mergedData).length} price cache entries in Firestore!`);
  } catch (error) {
    console.error('❌ Failed to update price cache:', error);
  }
}

main().catch(console.error);
