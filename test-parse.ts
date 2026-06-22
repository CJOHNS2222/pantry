import { parseIngredientForShoppingList } from './utils/appUtils.ts';

const tests = [
  "1 cup boneless chicken",
  "1 lb finely diced boneless chicken",
  "2 minced garlic cloves",
  "1/2 cup chopped onions",
  "boneless skinless chicken breast",
  "1 avocado, halved",
  "chicken breasts, cut into strips",
  "3 tablespoons jerk seasoning",
  "1 tblsp butter",
  "1 cucumber, seeded and diced",
  "fresh cilantro, to serve",
  "5 parts of jerk seasoning"
];

for (const t of tests) {
  console.log(t, "->", parseIngredientForShoppingList(t));
}

