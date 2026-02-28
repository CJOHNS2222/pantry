// Minimal shim for generated Spoonacular TypeScript client.
// This file provides lightweight stubs so Vite/Vitest can resolve imports
// when the real generated client is not present. Tests may mock this module.

export function createConfiguration(_: any) {
  return {};
}

export class RecipesApi {
  constructor(_cfg?: any) {}
  async extractRecipeFromUrl(_url: string) { return null; }
  async searchRecipes(_query: string, _number?: number, _offset?: number) { return null; }
  async complexSearch(_opts: any) { return null; }
  async getRecipeInformation(_id: number) { return null; }
  async getRecipePriceBreakdownByID(_id: number) { return null; }
}

export class IngredientsApi {
  constructor(_cfg?: any) {}
  async ingredientSearch(_q: string, ..._args: any[]) { return { results: [] }; }
  async getIngredientInformation(_id: number) { return null; }
  async mapIngredientsToGroceryProducts(_body: any) { return null; }
}

export class ProductsApi {
  constructor(_cfg?: any) {}
  async searchGroceryProductsByUPC(_upc: string) { return null; }
}

export class MiscApi {
  constructor(_cfg?: any) {}
  async imageAnalysisByURL(_url: string) { return null; }
}

export default {
  createConfiguration,
  RecipesApi,
  IngredientsApi,
  ProductsApi,
  MiscApi,
};
