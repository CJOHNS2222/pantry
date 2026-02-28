const BASE_URL = 'https://api.spoonacular.com';

const API_KEY = import.meta.env?.VITE_SPOONACULAR_API_KEY || process.env.VITE_SPOONACULAR_API_KEY || process.env.SPOONACULAR_API_KEY;

let _cachedRecipesApi: any | null | undefined = undefined;
async function getRecipesApi(): Promise<any | null> {
  if (_cachedRecipesApi !== undefined) return _cachedRecipesApi;
  try {
    // @ts-ignore - optional generated client may be absent from repo
    const mod = await import('../typescript/dist');
    const { createConfiguration, RecipesApi } = mod as any;
    if (!API_KEY) {
      _cachedRecipesApi = null;
      return null;
    }
    const config = createConfiguration({ authMethods: { apiKeyScheme: API_KEY } as any });
    const api = new RecipesApi(config);
    _cachedRecipesApi = api;
    return api;
  } catch (err) {
    // If dynamic import or instantiation fails, cache null to avoid repeated failures
    console.warn('Failed to initialize generated RecipesApi client', err);
    _cachedRecipesApi = null;
    return null;
  }
}

export default class SpoonacularRecipeClient {
  static async extractRecipeFromUrl(url: string) {
    const recipesApi = await getRecipesApi();
    if (recipesApi) {
      try {
        // Try generated client method names that may exist
        const api: any = recipesApi as any;
        if (api.extractRecipeFromUrl) {
          return await api.extractRecipeFromUrl(url);
        }
        if (api.getRecipeInformationFromUrl) {
          return await api.getRecipeInformationFromUrl(url);
        }
        // Fall back to fetch to the extract endpoint
      } catch (err) {
        console.warn('Generated RecipesApi extract attempt failed', err);
      }
    }

    if (!API_KEY) return null;
    try {
      const params = new URLSearchParams({ apiKey: API_KEY, url });
      const res = await fetch(`${BASE_URL}/recipes/extract?${params.toString()}`);
      if (!res.ok) {
        console.warn('Spoonacular extract returned non-ok status', res.status);
        return null;
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('SpoonacularRecipeClient.extractRecipeFromUrl failed', err);
      return null;
    }
  }

  static async searchRecipes(query: string = '', number = 10, offset = 0) {
    const recipesApi = await getRecipesApi();
    if (recipesApi) {
      try {
        const api: any = recipesApi as any;
        // Try several likely method names produced by different generator versions
        if (api.searchRecipes) return await api.searchRecipes(query, number, offset);
        if (api.searchRecipesByQuery) return await api.searchRecipesByQuery(query, number, offset);
        if (api.complexSearch) return await api.complexSearch({ query, number, offset });
      } catch (err) {
        console.warn('Generated RecipesApi search attempt failed', err);
      }
    }

    // Fallback to REST complexSearch
    if (!API_KEY) return null;
    try {
      const params = new URLSearchParams({ apiKey: API_KEY, number: number.toString(), offset: offset.toString(), addRecipeInformation: 'true', fillIngredients: 'true' });
      if (query) params.append('query', query);
      const res = await fetch(`${BASE_URL}/recipes/complexSearch?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.results || data;
    } catch (err) {
      console.warn('SpoonacularRecipeClient.searchRecipes failed', err);
      return null;
    }
  }

  static async getRecipeInformation(recipeId: number) {
    const recipesApi = await getRecipesApi();
    if (recipesApi) {
      try {
        const api: any = recipesApi as any;
        if (api.getRecipeInformation) return await api.getRecipeInformation(recipeId);
        if (api.getRecipeById) return await api.getRecipeById(recipeId);
      } catch (err) {
        console.warn('Generated RecipesApi getRecipeInformation failed', err);
      }
    }

    if (!API_KEY) return null;
    try {
      const params = new URLSearchParams({ apiKey: API_KEY });
      const res = await fetch(`${BASE_URL}/recipes/${recipeId}/information?${params.toString()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('SpoonacularRecipeClient.getRecipeInformation failed', err);
      return null;
    }
  }

  static async getRecipePriceBreakdown(recipeId: number) {
    const recipesApi = await getRecipesApi();
    if (recipesApi) {
      try {
        const api: any = recipesApi as any;
        if (api.getRecipePriceBreakdownByID) return await api.getRecipePriceBreakdownByID(recipeId);
        if (api.getRecipePriceBreakdown) return await api.getRecipePriceBreakdown(recipeId);
      } catch (err) {
        console.warn('Generated RecipesApi getRecipePriceBreakdown failed', err);
      }
    }

    if (!API_KEY) return null;
    try {
      const params = new URLSearchParams({ apiKey: API_KEY });
      const res = await fetch(`${BASE_URL}/recipes/${recipeId}/priceBreakdown?${params.toString()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('SpoonacularRecipeClient.getRecipePriceBreakdown failed', err);
      return null;
    }
  }
}
