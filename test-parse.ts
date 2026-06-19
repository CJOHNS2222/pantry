import { parseIngredientForShoppingList } from './utils/appUtils';

const tests = [
  "1 cup boneless chicken",
  "1 lb finely diced boneless chicken",
  "2 minced garlic cloves",
  "1/2 cup chopped onions",
  "boneless skinless chicken breast"
];

for (const t of tests) {
  console.log(t, "->", parseIngredientForShoppingList(t));
}
