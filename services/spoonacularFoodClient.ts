const API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SPOONACULAR_API_KEY) || process.env.VITE_SPOONACULAR_API_KEY || process.env.SPOONACULAR_API_KEY;

let _triedLoad = false;
let _generated: any = null;
let _cachedApis: { recipesApi?: any; ingredientsApi?: any; productsApi?: any; miscApi?: any } | null = null;

async function loadGeneratedClient() {
  if (_triedLoad) return _generated;
  _triedLoad = true;
  try {
    // dynamic import: only attempt when actually needed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - optional generated client may be absent from repo
    _generated = await import(/* @vite-ignore */ '../typescript/dist');
  } catch (_err) {
    _generated = null;
  }
  return _generated;
}

async function getApis() {
  if (_cachedApis) return _cachedApis;
  const mod = await loadGeneratedClient();
  if (!mod) {
    _cachedApis = {};
    return _cachedApis;
  }
  try {
    const cfg = typeof mod.createConfiguration === 'function' && API_KEY ? mod.createConfiguration({ authMethods: { apiKeyScheme: API_KEY } } as any) : undefined;
    _cachedApis = {
      recipesApi: cfg && mod.RecipesApi ? new mod.RecipesApi(cfg) : (mod.RecipesApi ? new mod.RecipesApi() : undefined),
      ingredientsApi: cfg && mod.IngredientsApi ? new mod.IngredientsApi(cfg) : (mod.IngredientsApi ? new mod.IngredientsApi() : undefined),
      productsApi: cfg && mod.ProductsApi ? new mod.ProductsApi(cfg) : (mod.ProductsApi ? new mod.ProductsApi() : undefined),
      miscApi: cfg && mod.MiscApi ? new mod.MiscApi(cfg) : (mod.MiscApi ? new mod.MiscApi() : undefined),
    };
  } catch (_err) {
    _cachedApis = {};
  }
  return _cachedApis;
}

export default class SpoonacularFoodClient {
  static async getIngredientInformation(name: string) {
    const apis = await getApis();
    if (apis.ingredientsApi) {
      try {
        const res = await (apis.ingredientsApi as any).ingredientSearch(name, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 0, 1);
        const results = (res && (res as any).results) || (res as any);
        const first = Array.isArray(results) ? results[0] : results;
        if (!first || !first.id) return null;
        const info = await apis.ingredientsApi.getIngredientInformation(first.id as any, undefined as any, undefined as any);
        return info;
      } catch (err) {
        console.warn('SpoonacularFoodClient.getIngredientInformation failed', err);
        return null;
      }
    }

    // Fallback: no generated client available — avoid throwing, return null
    console.debug('Spoonacular generated client not available; getIngredientInformation fallback returns null');
    return null;
  }

  static async mapIngredientsToProducts(ingredientList: string[]) {
    const apis = await getApis();
    if (apis.ingredientsApi) {
      try {
        const body = { ingredientList: ingredientList.join('\n') } as any;
        const mapped = await apis.ingredientsApi.mapIngredientsToGroceryProducts(body as any);
        return mapped;
      } catch (err) {
        console.warn('SpoonacularFoodClient.mapIngredientsToProducts failed', err);
        return null;
      }
    }
    console.debug('Spoonacular generated client not available; mapIngredientsToProducts fallback returns null');
    return null;
  }

  static async searchGroceryProductByUPC(upc: string) {
    const apis = await getApis();
    if (apis.productsApi) {
      try {
        const res = await apis.productsApi.searchGroceryProductsByUPC(upc as any);
        return res;
      } catch (err) {
        console.warn('SpoonacularFoodClient.searchGroceryProductByUPC failed', err);
        return null;
      }
    }
    console.debug('Spoonacular generated client not available; searchGroceryProductByUPC fallback returns null');
    return null;
  }

  static async analyzeImageUrl(imageUrl: string) {
    const apis = await getApis();
    if (apis.miscApi) {
      try {
        const res = await apis.miscApi.imageAnalysisByURL(imageUrl as any);
        return res;
      } catch (err) {
        console.warn('SpoonacularFoodClient.analyzeImageUrl failed', err);
        return null;
      }
    }
    console.debug('Spoonacular generated client not available; analyzeImageUrl fallback returns null');
    return null;
  }

  static async getRecipePriceBreakdownById(recipeId: number) {
    const apis = await getApis();
    if (apis.recipesApi) {
      try {
        const res = await apis.recipesApi.getRecipePriceBreakdownByID(recipeId as any);
        return res;
      } catch (err) {
        console.warn('SpoonacularFoodClient.getRecipePriceBreakdownById failed', err);
        return null;
      }
    }
    console.debug('Spoonacular generated client not available; getRecipePriceBreakdownById fallback returns null');
    return null;
  }
}
