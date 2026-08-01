# Nutrition Lookup & Barcode Scanning

Two related features: barcode scanning to identify a product, and nutrition-fact lookup for pantry/recipe items. Despite the common assumption, **neither uses OpenFoodFacts** - both go through Spoonacular and USDA.

## Barcode Scanning

- `utils/barcodeScan.ts` decodes a barcode from a photo captured on-device via [`@zxing/library`](https://github.com/zxing-js/library). This is native-only and photo-based - there is no live camera viewfinder/scanner UI, the user captures a still photo which is then decoded.
- The decoded UPC is resolved to a product title via **Spoonacular's** grocery product API (`spoonacularFoodClient.ts`, `searchGroceryProductByUPC`).
- That resolved product title then feeds into the nutrition lookup below.

## Nutrition Lookup

- `services/nutritionService.ts` looks up nutrition facts (calories, protein, carbs, fat, fiber, sugar) from the free **USDA FoodData Central API**.
- Requires `VITE_USDA_API_KEY` - get a free key at [fdc.nal.usda.gov/api-key-signup.html](https://fdc.nal.usda.gov/api-key-signup.html).
- Results are cached in `localStorage` for 90 days to minimize API calls and stay within USDA's rate limits.

## Environment Variables

```env
VITE_USDA_API_KEY=your_usda_api_key
VITE_SPOONACULAR_API_KEY=your_spoonacular_api_key
```

Spoonacular's free tier is 150 requests/day - shared with the recipe search/finder feature (`spoonacularRecipeClient.ts`), so barcode lookups and recipe search draw from the same daily quota.

## Data Flow

```
Photo capture → @zxing decode → UPC
  → Spoonacular grocery product search (searchGroceryProductByUPC) → product title
  → USDA FoodData Central lookup (nutritionService.ts) → nutrition facts (90-day cache)
```

## Related

- `readme/RECIPE_FINDER_INTEGRATION.md` - Spoonacular recipe search setup (shares the same API key/quota).
- `components/pantry/PantryScanner.tsx` - barcode capture UI entry point.
