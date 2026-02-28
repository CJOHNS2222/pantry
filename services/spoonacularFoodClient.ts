import { createConfiguration, RecipesApi, IngredientsApi, ProductsApi, MiscApi } from '../typescript/dist';

const API_KEY = import.meta.env?.VITE_SPOONACULAR_API_KEY || process.env.VITE_SPOONACULAR_API_KEY || process.env.SPOONACULAR_API_KEY;

function makeConfig() {
  if (!API_KEY) return undefined;
  return createConfiguration({ authMethods: { apiKeyScheme: API_KEY } as any });
}

const config = makeConfig();

const recipesApi = config ? new RecipesApi(config) : null;
const ingredientsApi = config ? new IngredientsApi(config) : null;
const productsApi = config ? new ProductsApi(config) : null;
const miscApi = config ? new MiscApi(config) : null;

export default class SpoonacularFoodClient {
  static async getIngredientInformation(name: string) {
    if (!ingredientsApi) return null;
    try {
      // The generated client exposes ingredientSearch to find ids
      const res = await (ingredientsApi as any).ingredientSearch(name, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0, 1);
      const results = (res && (res as any).results) || (res as any);
      const first = Array.isArray(results) ? results[0] : results;
      if (!first || !first.id) return null;
      const info = await ingredientsApi.getIngredientInformation(first.id as any, undefined as any, undefined as any);
      return info;
    } catch (err) {
      console.warn('SpoonacularFoodClient.getIngredientInformation failed', err);
      return null;
    }
  }

  static async mapIngredientsToProducts(ingredientList: string[]) {
    if (!ingredientsApi) return null;
    try {
      const body = { ingredientList: ingredientList.join('\n') } as any;
      const mapped = await ingredientsApi.mapIngredientsToGroceryProducts(body as any);
      return mapped;
    } catch (err) {
      console.warn('SpoonacularFoodClient.mapIngredientsToProducts failed', err);
      return null;
    }
  }

  static async searchGroceryProductByUPC(upc: string) {
    if (!productsApi) return null;
    try {
      const res = await productsApi.searchGroceryProductsByUPC(upc as any);
      return res;
    } catch (err) {
      console.warn('SpoonacularFoodClient.searchGroceryProductByUPC failed', err);
      return null;
    }
  }

  static async analyzeImageUrl(imageUrl: string) {
    if (!miscApi) return null;
    try {
      const res = await miscApi.imageAnalysisByURL(imageUrl as any);
      return res;
    } catch (err) {
      console.warn('SpoonacularFoodClient.analyzeImageUrl failed', err);
      return null;
    }
  }

  // Expose recipe price breakdown for use by food-cost UI
  static async getRecipePriceBreakdownById(recipeId: number) {
    if (!recipesApi) return null;
    try {
      const res = await recipesApi.getRecipePriceBreakdownByID(recipeId as any);
      return res;
    } catch (err) {
      console.warn('SpoonacularFoodClient.getRecipePriceBreakdownById failed', err);
      return null;
    }
  }
}
