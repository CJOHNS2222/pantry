import { describe, it, expect } from 'vitest';
import { inferStorageLocationFromItemName, parseIngredientForShoppingList } from '../../../utils/appUtils';

// Test utility functions from App.tsx
describe('next7DateKeys', () => {
  it('should return 7 date keys', () => {
    const result = next7DateKeys();

    expect(result).toHaveLength(7);
    expect(typeof result[0]).toBe('string');
    expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
  });

  it('should return consecutive dates', () => {
    const result = next7DateKeys();

    expect(result).toHaveLength(7);
    for (let i = 1; i < result.length; i++) {
      const prevDate = new Date(result[i - 1]!);
      const currentDate = new Date(result[i]!);
      const diffTime = currentDate.getTime() - prevDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    }
  });
});

// Helper function to test (extracted from App.tsx)
function next7DateKeys(start = new Date()) {
  const keys: string[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const k = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    keys.push(k);
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

describe('inferStorageLocationFromItemName', () => {
  it('should place fridge items in fridge', () => {
    expect(inferStorageLocationFromItemName('milk')).toBe('fridge');
    expect(inferStorageLocationFromItemName('cheese')).toBe('fridge');
    expect(inferStorageLocationFromItemName('yogurt')).toBe('fridge');
    expect(inferStorageLocationFromItemName('butter')).toBe('fridge');
    expect(inferStorageLocationFromItemName('eggs')).toBe('fridge');
    expect(inferStorageLocationFromItemName('lettuce')).toBe('fridge');
    expect(inferStorageLocationFromItemName('spinach')).toBe('fridge');
    expect(inferStorageLocationFromItemName('carrot')).toBe('fridge');
    expect(inferStorageLocationFromItemName('celery')).toBe('fridge');
    expect(inferStorageLocationFromItemName('strawberry')).toBe('fridge');
    expect(inferStorageLocationFromItemName('blueberry')).toBe('fridge');
    expect(inferStorageLocationFromItemName('cream')).toBe('fridge');
    expect(inferStorageLocationFromItemName('sour cream')).toBe('fridge');
    expect(inferStorageLocationFromItemName('cottage cheese')).toBe('fridge');
    expect(inferStorageLocationFromItemName('hot sauce')).toBe('fridge');
    expect(inferStorageLocationFromItemName('barbecue sauce')).toBe('fridge');
    expect(inferStorageLocationFromItemName('soy sauce')).toBe('fridge');
    expect(inferStorageLocationFromItemName('salad dressing')).toBe('fridge');
    expect(inferStorageLocationFromItemName('lunch meat')).toBe('fridge');
    expect(inferStorageLocationFromItemName('cold cut')).toBe('fridge');
    expect(inferStorageLocationFromItemName('prosciutto')).toBe('fridge');
    expect(inferStorageLocationFromItemName('fresh basil')).toBe('fridge');
    expect(inferStorageLocationFromItemName('fresh parsley')).toBe('fridge');
    expect(inferStorageLocationFromItemName('fresh fish')).toBe('fridge');
    expect(inferStorageLocationFromItemName('fresh shrimp')).toBe('fridge');
  });

  it('should place sandwich meats in fridge', () => {
    expect(inferStorageLocationFromItemName('sliced roast beef')).toBe('fridge');
    expect(inferStorageLocationFromItemName('sliced turkey')).toBe('fridge');
    expect(inferStorageLocationFromItemName('sliced ham')).toBe('fridge');
    expect(inferStorageLocationFromItemName('sliced bologna')).toBe('fridge');
    expect(inferStorageLocationFromItemName('sliced salami')).toBe('fridge');
  });

  it('should place other meats in freezer', () => {
    expect(inferStorageLocationFromItemName('chicken')).toBe('freezer');
    expect(inferStorageLocationFromItemName('beef')).toBe('freezer');
    expect(inferStorageLocationFromItemName('pork')).toBe('freezer');
    expect(inferStorageLocationFromItemName('fish')).toBe('freezer');
    expect(inferStorageLocationFromItemName('salmon')).toBe('freezer');
    expect(inferStorageLocationFromItemName('bacon')).toBe('freezer');
    expect(inferStorageLocationFromItemName('sausage')).toBe('freezer');
    expect(inferStorageLocationFromItemName('ground turkey')).toBe('freezer');
    expect(inferStorageLocationFromItemName('chicken breast')).toBe('freezer');
    expect(inferStorageLocationFromItemName('pork chop')).toBe('freezer');
    expect(inferStorageLocationFromItemName('lamb chop')).toBe('freezer');
    expect(inferStorageLocationFromItemName('venison')).toBe('freezer');
    expect(inferStorageLocationFromItemName('frozen pizza')).toBe('freezer');
    expect(inferStorageLocationFromItemName('frozen meal')).toBe('freezer');
    expect(inferStorageLocationFromItemName('frozen yogurt')).toBe('freezer');
    expect(inferStorageLocationFromItemName('sorbet')).toBe('freezer');
  });

  it('should place spices in spices location', () => {
    expect(inferStorageLocationFromItemName('salt')).toBe('spices');
    expect(inferStorageLocationFromItemName('pepper')).toBe('spices');
    expect(inferStorageLocationFromItemName('cumin')).toBe('spices');
    expect(inferStorageLocationFromItemName('paprika')).toBe('spices');
    expect(inferStorageLocationFromItemName('oregano')).toBe('spices');
    expect(inferStorageLocationFromItemName('basil')).toBe('spices');
    expect(inferStorageLocationFromItemName('cinnamon')).toBe('spices');
    expect(inferStorageLocationFromItemName('vanilla extract')).toBe('spices');
    expect(inferStorageLocationFromItemName('baking powder')).toBe('spices');
    expect(inferStorageLocationFromItemName('baking soda')).toBe('spices');
    expect(inferStorageLocationFromItemName('seasoning')).toBe('spices');
    expect(inferStorageLocationFromItemName('italian seasoning')).toBe('spices');
    expect(inferStorageLocationFromItemName('taco seasoning')).toBe('spices');
    expect(inferStorageLocationFromItemName('yeast')).toBe('spices');
    expect(inferStorageLocationFromItemName('cornstarch')).toBe('spices');
    expect(inferStorageLocationFromItemName('gelatin')).toBe('spices');
    expect(inferStorageLocationFromItemName('almond extract')).toBe('spices');
    expect(inferStorageLocationFromItemName('dried basil')).toBe('spices');
  });

  it('should place storage items in other location', () => {
    expect(inferStorageLocationFromItemName('ziploc bags')).toBe('other');
    expect(inferStorageLocationFromItemName('aluminum foil')).toBe('other');
    expect(inferStorageLocationFromItemName('saran wrap')).toBe('other');
    expect(inferStorageLocationFromItemName('parchment paper')).toBe('other');
    expect(inferStorageLocationFromItemName('wax paper')).toBe('other');
    expect(inferStorageLocationFromItemName('plastic wrap')).toBe('other');
    expect(inferStorageLocationFromItemName('storage bag')).toBe('other');
    expect(inferStorageLocationFromItemName('tupperware')).toBe('other');
    expect(inferStorageLocationFromItemName('butcher paper')).toBe('other');
    expect(inferStorageLocationFromItemName('facial tissue')).toBe('other');
    expect(inferStorageLocationFromItemName('paper plate')).toBe('other');
    expect(inferStorageLocationFromItemName('bleach')).toBe('other');
  });

  it('should place pantry items in pantry', () => {
    expect(inferStorageLocationFromItemName('pasta')).toBe('pantry');
    expect(inferStorageLocationFromItemName('rice')).toBe('pantry');
    expect(inferStorageLocationFromItemName('flour')).toBe('pantry');
    expect(inferStorageLocationFromItemName('sugar')).toBe('pantry');
    expect(inferStorageLocationFromItemName('bread')).toBe('pantry');
    expect(inferStorageLocationFromItemName('canned soup')).toBe('pantry');
    expect(inferStorageLocationFromItemName('peanut butter')).toBe('pantry');
    expect(inferStorageLocationFromItemName('coffee')).toBe('pantry');
    expect(inferStorageLocationFromItemName('tea')).toBe('pantry');
    expect(inferStorageLocationFromItemName('potato')).toBe('pantry');
    expect(inferStorageLocationFromItemName('onion')).toBe('pantry');
    expect(inferStorageLocationFromItemName('garlic')).toBe('pantry');
    expect(inferStorageLocationFromItemName('apple')).toBe('pantry');
    expect(inferStorageLocationFromItemName('orange')).toBe('pantry');
    expect(inferStorageLocationFromItemName('banana')).toBe('pantry');
    expect(inferStorageLocationFromItemName('avocado')).toBe('pantry');
    expect(inferStorageLocationFromItemName('tomato')).toBe('pantry');
    expect(inferStorageLocationFromItemName('tortilla')).toBe('pantry');
    expect(inferStorageLocationFromItemName('bagel')).toBe('pantry');
    expect(inferStorageLocationFromItemName('syrup')).toBe('pantry');
    expect(inferStorageLocationFromItemName('maple syrup')).toBe('pantry');
    expect(inferStorageLocationFromItemName('almond butter')).toBe('pantry');
    expect(inferStorageLocationFromItemName('jelly')).toBe('pantry');
    expect(inferStorageLocationFromItemName('pickle')).toBe('pantry');
    expect(inferStorageLocationFromItemName('olive')).toBe('pantry');
  });

  it('should default to pantry for unknown items', () => {
    expect(inferStorageLocationFromItemName('unknown item')).toBe('pantry');
    expect(inferStorageLocationFromItemName('random food')).toBe('pantry');
  });
});

describe('parseIngredientForShoppingList', () => {
  it('parses standard quantity + unit + name', () => {
    const r = parseIngredientForShoppingList('2 cups chicken broth');
    expect(r.quantity).toBe('2 cups');
    expect(r.itemName).toBe('Chicken Broth');
  });

  it('parses fraction quantity', () => {
    const r = parseIngredientForShoppingList('1/2 cup butter');
    expect(r.quantity).toBe('1/2 cup');
    expect(r.itemName).toBe('Butter');
  });

  it('handles Unicode fraction prefix (½)', () => {
    const r = parseIngredientForShoppingList('½ tsp smoked paprika');
    expect(r.quantity).toBe('1/2 tsp');
    expect(r.itemName).toBe('Smoked Paprika');
  });

  it('handles mixed fraction (1 1/2)', () => {
    const r = parseIngredientForShoppingList('1 1/2 cups flour');
    expect(r.quantity).toBe('1.5 cups');
    expect(r.itemName).toBe('Flour');
  });

  it('strips "to taste" prefix', () => {
    const r = parseIngredientForShoppingList('to taste pepper');
    expect(r.quantity).toBe('to taste');
    expect(r.itemName).toBe('Pepper');
  });

  it('strips "to taste" suffix', () => {
    const r = parseIngredientForShoppingList('salt to taste');
    expect(r.quantity).toBe('to taste');
    expect(r.itemName).toBe('Salt');
  });

  it('strips "to taste" after comma', () => {
    const r = parseIngredientForShoppingList('salt, to taste');
    expect(r.quantity).toBe('to taste');
    expect(r.itemName).toBe('Salt');
  });

  it('handles "an" article without unit', () => {
    const r = parseIngredientForShoppingList('an egg');
    expect(r.quantity).toBe('1');
    expect(r.itemName).toBe('Egg');
  });

  it('handles "an" article with following noun phrase', () => {
    const r = parseIngredientForShoppingList('an avocado, sliced');
    expect(r.quantity).toBe('1');
    expect(r.itemName).toBe('Avocado');
  });

  it('handles "a" article without unit', () => {
    const r = parseIngredientForShoppingList('a garlic clove');
    expect(r.quantity).toBe('1');
    expect(r.itemName).toBe('Garlic Clove');
  });

  it('strips trailing comma+descriptor (minced)', () => {
    const r = parseIngredientForShoppingList('2 cloves garlic, minced');
    expect(r.quantity).toBe('2 cloves');
    expect(r.itemName).toBe('Garlic');
  });

  it('strips trailing comma+descriptor (divided)', () => {
    const r = parseIngredientForShoppingList('1/2 cup olive oil, divided');
    expect(r.quantity).toBe('1/2 cup');
    expect(r.itemName).toBe('Olive Oil');
  });

  it('strips parenthetical size note', () => {
    const r = parseIngredientForShoppingList('1 can (14.5 oz) diced tomatoes');
    expect(r.quantity).toBe('1 can');
    expect(r.itemName).toBe('Tomatoes');
    expect(r.prepNotes).toBe('diced');
  });

  it('strips parenthetical alternative note', () => {
    const r = parseIngredientForShoppingList('2 cups chicken broth (or water)');
    expect(r.quantity).toBe('2 cups');
    expect(r.itemName).toBe('Chicken Broth');
  });

  it('defaults to qty 1 when no quantity detected', () => {
    const r = parseIngredientForShoppingList('fresh cilantro');
    expect(r.quantity).toBe('1');
    expect(r.itemName).toBe('Fresh Cilantro');
  });

  it('handles user specific cleanup cases (halved, cut into strips, tblsp, seeded and diced, to serve, parts)', () => {
    // 1) halved
    const r1 = parseIngredientForShoppingList('1 avocado, halved');
    expect(r1.itemName).toBe('Avocado');
    expect(r1.prepNotes).toContain('halved');

    // 2) cut into strips
    const r2 = parseIngredientForShoppingList('chicken breasts, cut into strips');
    expect(r2.itemName).toBe('Chicken Breasts');
    expect(r2.prepNotes).toContain('strips');

    // 3) tblsp unit
    const r3 = parseIngredientForShoppingList('1 tblsp butter');
    expect(r3.quantity).toBe('1 tblsp');
    expect(r3.itemName).toBe('Butter');

    // 4) seeded and diced
    const r4 = parseIngredientForShoppingList('1 cucumber, seeded and diced');
    expect(r4.itemName).toBe('Cucumber');
    expect(r4.prepNotes).toContain('seeded');
    expect(r4.prepNotes).toContain('diced');

    // 5) to serve
    const r5 = parseIngredientForShoppingList('fresh cilantro, to serve');
    expect(r5.itemName).toBe('Fresh Cilantro');

    // 6) parts
    const r6 = parseIngredientForShoppingList('5 parts of jerk seasoning');
    expect(r6.quantity).toBe('5 parts');
    expect(r6.itemName).toBe('Jerk Seasoning');
  });
});

