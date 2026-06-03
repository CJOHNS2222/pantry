import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure API key is present so the client instantiates APIs
process.env.SPOONACULAR_API_KEY = 'test-key';

vi.mock('../../../typescript/dist', () => {
  class RecipesApi {
    constructor() {}
    async getRecipePriceBreakdownByID(id: number) { return { id, breakdown: [] }; }
  }
  class IngredientsApi {
    constructor() {}
    async ingredientSearch(name: string, ...args: any[]) { return { results: [{ id: 123 }] }; }
    async getIngredientInformation(id: number) { return { id, name: 'MockIngredient' }; }
    async mapIngredientsToGroceryProducts(body: any) { return { mapped: body.ingredientList }; }
  }
  class ProductsApi {
    constructor() {}
    async searchGroceryProductsByUPC(upc: string) { return { upc, product: 'MockProduct' }; }
  }
  class MiscApi {
    constructor() {}
    async imageAnalysisByURL(url: string) { return { url, tags: [] }; }
  }

  return {
    createConfiguration: (opts: any) => ({ opts }),
    RecipesApi,
    IngredientsApi,
    ProductsApi,
    MiscApi
  };
});

import SpoonacularFoodClient from '../../../services/spoonacularFoodClient';

describe('SpoonacularFoodClient', () => {
  beforeEach(() => vi.resetAllMocks());

  it('getIngredientInformation returns ingredient info', async () => {
    const res = await SpoonacularFoodClient.getIngredientInformation('salt');
    expect(res).toBeDefined();
    expect((res as any).name).toBe('MockIngredient');
  });

  it('mapIngredientsToProducts maps list to products', async () => {
    const res = await SpoonacularFoodClient.mapIngredientsToProducts(['1 cup flour', '2 eggs']);
    expect(res).toBeDefined();
    expect((res as any).mapped).toContain('1 cup flour');
  });

  it('searchGroceryProductByUPC returns product info', async () => {
    const res = await SpoonacularFoodClient.searchGroceryProductByUPC('012345678905');
    expect(res).toBeDefined();
    expect((res as any).product).toBe('MockProduct');
  });

  it('analyzeImageUrl returns analysis', async () => {
    const res = await SpoonacularFoodClient.analyzeImageUrl('https://example.com/image.jpg');
    expect(res).toBeDefined();
    expect((res as any).tags).toBeDefined();
  });

  it('getRecipePriceBreakdownById returns breakdown', async () => {
    const res = await SpoonacularFoodClient.getRecipePriceBreakdownById(42);
    expect(res).toBeDefined();
    expect((res as any).id).toBe(42);
  });
});
