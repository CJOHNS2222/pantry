import { getPerformance, trace } from "firebase/performance";
import { StructuredIngredient } from '../types';
import { parseQuantityAndUnit } from './quantityMathUtils';

const performance = getPerformance();

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
    itemName = itemName.replace(/,\s*$/, '').replace(/\s+,\s+/g, ' ').replace(/^,\s*/, '').trim();
    itemName = itemName.replace(/\s+/g, ' ');

    // Capitalize first letter of each word for better display
    itemName = itemName.replace(/\b\w/g, l => l.toUpperCase());

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
 * Parses a raw ingredient string into a normalized structured record
 * ({name, quantity, unit, preparation, raw_string}) for persistence and
 * server-side-friendly consolidation, instead of re-parsing the raw string
 * on every read (PERF-028).
 */
export function parseStructuredIngredient(raw: string): StructuredIngredient {
  const { quantity: quantityStr, itemName, prepNotes } = parseIngredientForShoppingList(raw);
  const { amount, unit } = parseQuantityAndUnit(quantityStr, itemName);

  return {
    name: itemName,
    quantity: Number.isFinite(amount) ? amount : undefined,
    unit: unit || undefined,
    preparation: prepNotes,
    raw_string: raw,
  };
}

/**
 * Cleans item names by removing descriptive words for shopping list display
 * @param itemName Raw item name (e.g., "chopped onions", "minced garlic")
 * @returns Cleaned item name (e.g., "Onions", "Garlic")
 */
export function cleanItemNameForShopping(itemName: string): string {
  let cleaned = itemName.toLowerCase()
    // Remove parenthesized notes, sizes, or details (e.g. "(460g)", "(approx 2 cups)")
    .replace(/\s*\([^)]*\)/g, '')
    // Remove unicode fractions
    .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, '')
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
    .replace(/\b(fresh|dried|canned|chopped|sliced|diced|minced|crushed|ground|cubed|grated|finely|halved|seeded|shredded|julienned|torn|plucked|to serve|for serving|strips|whole|plain|boiling|hot|cold|warm|all-purpose|all purpose|store-bought|store bought)\b/g, '')
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
