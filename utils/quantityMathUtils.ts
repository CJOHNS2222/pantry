import { ShoppingItem, PantryItem } from '../types';
import { getQuantityAmount, getQuantityUnit } from './quantityUtils';
import { convertToMetric, convertToStandard } from './measurementUtils';
import { parseIngredientForShoppingList } from './ingredientParsingUtils';

// Enhanced quantity management utilities
export interface ParsedQuantity {
  amount: number;
  unit: string;
}

export interface QuantityResult {
  amount: number;
  unit: string;
  normalizedGrams?: number; // For comparison
  /** Weight and volume are never combined with each other, even though both are stored
   *  in normalizedGrams (a 1ml≈1g simplification) — this keeps them from cross-matching.
   *  Containers (can, bag, ...) count as 'weight' since they're standardized to grams. */
  normalizedKind?: 'weight' | 'volume';
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
  'lbs': 453.59,
  'pound': 453.59,
  'pounds': 453.59,

  // Volume (approximate conversions to ml)
  'ml': 1,
  'milliliter': 1,
  'milliliters': 1,
  'l': 1000,
  'liter': 1000,
  'liters': 1000,
  'fl oz': 29.57,
  'fluid ounce': 29.57,
  'fluid ounces': 29.57,
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

  // Standardized container weights (approximate grams per container) — used so e.g.
  // "1 can" combines with "400g" of the same item under one common unit. These are
  // reasonable category averages (a "can" of beans and a "can" of tomatoes are both
  // ~400g), not exact per-product sizes — there's no per-product size data in the
  // app to be more precise than this. Needed so consolidated shopping-list
  // quantities can eventually be sent to a grocery cart/checkout integration.
  'can': 400,
  'cans': 400,
  'jar': 450,
  'jars': 450,
  'bottle': 500,
  'bottles': 500,
  'package': 400,
  'packages': 400,
  'pkg': 400,
  'box': 350,
  'boxes': 350,
  'bag': 450,
  'bags': 450,
  'container': 450,
  'containers': 450,
  'pack': 400,
  'packs': 400,

  // Count units (no conversion — these vary too much in size to standardize, e.g.
  // a "piece" or "clove" has no consistent weight)
  'count': 1,
  'piece': 1,
  'pieces': 1,
  'slice': 1,
  'slices': 1,
  'clove': 1,
  'cloves': 1,
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
  'dozen': 1,
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

  // For weight units (and standardized containers, which are weight-equivalent),
  // convert to grams.
  const lowUnit = key;
  const weightUnits = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'];
  // Standardized containers (can, jar, bottle, box, bag, package, pack) — normalized to
  // their approximate gram equivalent so they combine with true weight quantities of
  // the same item under one common unit.
  const containerUnits = ['can', 'cans', 'jar', 'jars', 'bottle', 'bottles', 'package', 'packages', 'pkg', 'box', 'boxes', 'bag', 'bags', 'container', 'containers', 'pack', 'packs'];
  if (weightUnits.includes(lowUnit) || containerUnits.includes(lowUnit)) {
    return {
      ...quantity,
      normalizedGrams: quantity.amount * conversionFactor,
      normalizedKind: 'weight',
    };
  }

  const volumeUnits = ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'fl oz', 'fluid ounce', 'fluid ounces', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'qt', 'quart', 'quarts', 'pt', 'pint', 'pints', 'gal', 'gallon', 'gallons'];
  if (volumeUnits.includes(lowUnit)) {
    return {
      ...quantity,
      normalizedGrams: quantity.amount * conversionFactor, // Using grams field for volume too
      normalizedKind: 'volume',
    };
  }

  // For remaining count units (piece, clove, bunch, dozen, ...), no normalization —
  // these have no consistent standardized size.
  return { ...quantity };
}

/**
 * Convert an amount from one unit to another, when both are weight units or both
 * are volume units (via their shared grams/ml basis in UNIT_CONVERSIONS). Returns
 * null when the units aren't compatible (e.g. weight vs. volume, or either is a
 * count unit like "each"/"clove") — callers must not assume conversion always
 * succeeds, since count units have no consistent real-world size to convert by.
 */
export function convertQuantity(amount: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeQuantity({ amount, unit: fromUnit });
  if (from.normalizedGrams === undefined) return null;

  const to = normalizeQuantity({ amount: 1, unit: toUnit });
  if (to.normalizedGrams === undefined || to.normalizedKind !== from.normalizedKind) return null;

  return from.normalizedGrams / to.normalizedGrams;
}

/**
 * Check if two quantities can be combined (same unit type)
 */
export function canCombineQuantities(q1: ParsedQuantity, q2: ParsedQuantity): boolean {
  const n1 = normalizeQuantity(q1);
  const n2 = normalizeQuantity(q2);

  // Both normalized to the same kind (weight or volume), or both are plain counts.
  // Weight and volume are never cross-combined, even though both use the
  // normalizedGrams field, since a ml isn't a gram.
  if (n1.normalizedGrams === undefined || n2.normalizedGrams === undefined) {
    return n1.normalizedGrams === undefined && n2.normalizedGrams === undefined;
  }
  return n1.normalizedKind === n2.normalizedKind;
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
 * Reduces a grocery item name to a simple singular form for matching purposes only
 * (e.g. "onions" -> "onion", "tomatoes" -> "tomato"). Never used for display — recipes
 * often supply the same ingredient as singular in one place and plural in another
 * ("1 onion" vs "2 onions"), and without this the exact-string match in
 * consolidateShoppingList treats them as different items.
 */
function singularizeForMatching(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  // Words where a trailing "s" is part of the word itself, not a plural marker
  // (hummus, asparagus, couscous, citrus, octopus, ...)
  if (/(ss|us|is)$/.test(w)) return w;
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y'; // berries -> berry
  if (/(oes|ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2); // tomatoes -> tomato, boxes -> box
  if (/s$/.test(w)) return w.slice(0, -1); // onions -> onion, prawns -> prawn
  return w;
}

/**
 * Consolidates duplicate shopping list items by name and checked status,
 * combining quantities safely using unit conversion.
 */
export function consolidateShoppingList(items: ShoppingItem[]): ShoppingItem[] {
  const consolidatedMap = new Map<string, ShoppingItem>();

  items.forEach(item => {
    if (!item.item) return;

    // Check if amount and unit are already structured
    let amount = item.amount;
    let unit = item.unit;

    if (amount === undefined || unit === undefined) {
      const parsed = parseQuantityAndUnit(item.quantity, item.item);
      amount = parsed.amount;
      unit = parsed.unit;
    }

    const n = normalizeQuantity({ amount, unit });
    const isNormalized = n !== null && n.normalizedGrams !== undefined;
    const unitType = isNormalized ? 'measurable' : 'count';

    const normalizedName = singularizeForMatching(item.item.trim().toLowerCase());
    const key = `${normalizedName}_${item.checked}_${unitType}`;
    const existing = consolidatedMap.get(key);

    if (!existing) {
      consolidatedMap.set(key, {
        ...item,
        amount,
        unit,
        quantity: amount === 1 && (unit === 'pcs' || unit === 'pieces') ? '1' : `${amount} ${unit}`,
        consolidatedItems: [{
          id: item.id,
          addedAt: item.addedAt,
          quantity: item.quantity,
          amount,
          unit,
          source: item.source
        }]
      });
      return;
    }

    const q1 = { amount: existing.amount ?? 1, unit: existing.unit ?? 'pcs' };
    const q2 = { amount, unit };

    if (canCombineQuantities(q1, q2)) {
      const combined = combineQuantities(q1, q2);
      existing.amount = combined.amount;
      existing.unit = combined.unit;
      existing.quantity = combined.amount === 1 && (combined.unit === 'pcs' || combined.unit === 'pieces') ? '1' : `${combined.amount} ${combined.unit}`;

      // Merge sources cleanly without duplication
      if (item.source && existing.source) {
        const sources = new Set([
          ...existing.source.split(',').map(s => s.trim()),
          ...item.source.split(',').map(s => s.trim())
        ]);
        existing.source = Array.from(sources).join(', ');
      } else if (item.source) {
        existing.source = item.source;
      }

      // Merge prep notes / preparation modifiers
      if (item.notes && existing.notes) {
        const notesSet = new Set([
          ...existing.notes.split(',').map(n => n.trim()),
          ...item.notes.split(',').map(n => n.trim())
        ]);
        existing.notes = Array.from(notesSet).join(', ');
      } else if (item.notes) {
        existing.notes = item.notes;
      }

      // Add estimated prices
      if (existing.estimatedPrice !== undefined || item.estimatedPrice !== undefined) {
        existing.estimatedPrice = (existing.estimatedPrice || 0) + (item.estimatedPrice || 0);
      }

      // Track individual item additions for consolidated list
      if (!existing.consolidatedItems) {
        existing.consolidatedItems = [];
      }
      existing.consolidatedItems.push({
        id: item.id,
        addedAt: item.addedAt,
        quantity: item.quantity,
        amount,
        unit,
        source: item.source
      });
    } else {
      // Fallback: If they can't be combined for some reason, append a suffix to the key
      const fallbackKey = `${key}_${existing.id}_${item.id}`;
      consolidatedMap.set(fallbackKey, {
        ...item,
        amount,
        unit,
        quantity: amount === 1 && (unit === 'pcs' || unit === 'pieces') ? '1' : `${amount} ${unit}`,
        consolidatedItems: [{
          id: item.id,
          addedAt: item.addedAt,
          quantity: item.quantity,
          amount,
          unit,
          source: item.source
        }]
      });
    }
  });

  return Array.from(consolidatedMap.values());
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

/**
 * Resolves the common/default unit for certain types of items
 */
export function getCommonUnitForItem(itemName: string): string {
  const name = (itemName || '').toLowerCase().trim();
  if (name.includes('egg')) return 'dozen';
  if (name.includes('apple') || name.includes('banana') || name.includes('potato') || name.includes('onion') || name.includes('tomato') || name.includes('orange')) {
    if (name.includes('apple') || name.includes('potato')) return 'lbs';
    if (name.includes('egg')) return 'dozen';
    return 'pcs';
  }
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || name.includes('fish') || name.includes('meat') || name.includes('cheese')) return 'lbs';
  if (name.includes('milk')) {
    if (name.includes('condensed') || name.includes('evaporated') || name.includes('powdered')) {
      return 'pcs';
    }
    return 'gallons';
  }
  if (name.includes('juice') || name.includes('soda') || name.includes('water') || name.includes('broth')) return 'cups';
  if (name.includes('flour') || name.includes('sugar') || name.includes('rice')) return 'lbs';
  return 'pcs';
}

/**
 * Parses a combined quantity string or number into a separate numeric amount and unit
 */
export function parseQuantityAndUnit(quantityStrOrNum: string | number | undefined, itemName: string): { amount: number; unit: string } {
  const defaultUnit = getCommonUnitForItem(itemName);
  if (quantityStrOrNum === undefined || quantityStrOrNum === null) {
    return { amount: 1, unit: defaultUnit };
  }
  if (typeof quantityStrOrNum === 'number') {
    return { amount: quantityStrOrNum, unit: defaultUnit };
  }

  const trimmed = quantityStrOrNum.trim();
  if (!trimmed) {
    return { amount: 1, unit: defaultUnit };
  }

  // Handle fractional unicode characters
  const normalized = trimmed
    .replace(/½/g, '0.5')
    .replace(/¼/g, '0.25')
    .replace(/¾/g, '0.75')
    .replace(/⅓/g, '0.33')
    .replace(/⅔/g, '0.67');

  // Match leading number (decimals, fractions like 1/2, or mixed like 1 1/2)
  const numMatch = normalized.match(/^(\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?)/);
  if (numMatch) {
    const numStr = numMatch[1].trim();
    let amount = parseFloat(numStr);
    if (numStr.includes('/')) {
      const parts = numStr.split(/\s+/);
      if (parts.length === 2) {
        const [num, den] = parts[1].split('/').map(Number);
        amount = parseFloat(parts[0]) + (num / den);
      } else {
        const [num, den] = numStr.split('/').map(Number);
        amount = num / den;
      }
    }
    let unitStr = normalized.replace(numMatch[0], '').trim().toLowerCase();

    // Normalize unit aliases
    if (unitStr === 'pieces' || unitStr === 'piece' || unitStr === 'count' || unitStr === 'each' || unitStr === 'pcs') {
      unitStr = 'pcs';
    } else if (unitStr === 'dozens' || unitStr === 'dozen') {
      unitStr = 'dozen';
    } else if (unitStr === 'pound' || unitStr === 'pounds' || unitStr === 'lb' || unitStr === 'lbs') {
      unitStr = 'lbs';
    } else if (unitStr === 'ounce' || unitStr === 'ounces' || unitStr === 'oz') {
      unitStr = 'oz';
    } else if (unitStr === 'gram' || unitStr === 'grams' || unitStr === 'g') {
      unitStr = 'g';
    } else if (unitStr === 'kilogram' || unitStr === 'kilograms' || unitStr === 'kg') {
      unitStr = 'kg';
    } else if (unitStr === 'cup' || unitStr === 'cups' || unitStr === 'c') {
      unitStr = 'cups';
    } else if (unitStr === 'tablespoon' || unitStr === 'tablespoons' || unitStr === 'tbsp') {
      unitStr = 'tbsp';
    } else if (unitStr === 'teaspoon' || unitStr === 'teaspoons' || unitStr === 'tsp') {
      unitStr = 'tsp';
    }

    return { amount: isNaN(amount) ? 1 : amount, unit: unitStr || defaultUnit };
  }

  return { amount: 1, unit: trimmed.toLowerCase() || defaultUnit };
}
