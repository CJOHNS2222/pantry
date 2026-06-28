import { PantryItem, StructuredRecipe } from '../types';
import { InventoryCacheService } from './inventoryCacheService';
import { log } from './logService';

/**
 * Minimal CSV parser for pantry imports. Expects header row containing columns like:
 * item,name,amount,quantity,unit,storageLocation,expirationDate,category
 */
export function parseCsvToPantryItems(csvText: string): PantryItem[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1);
  const items: PantryItem[] = [];
  for (const row of rows) {
    const cols = row.split(',').map(c => c.trim());
    const record: any = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = cols[i] || '';
    }

    const id = `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const item: PantryItem = {
      id,
      item: (record['item'] || record['name'] || '').trim(),
      quantity_estimate: (record['amount'] || record['quantity'] || '').toString(),
      storageLocation: (record['storagelocation'] || record['location'] || 'pantry') as any,
      expirationDate: record['expirationdate'] || record['expires'] || '',
      category: record['category'] || 'Manual',
      image: '',
      dateAdded: new Date().toISOString()
    } as PantryItem;
    if (item.item) items.push(item);
  }
  return items;
}

/**
 * Very small scraper fallback: attempt to fetch a URL and extract title and meta description.
 * Returns a StructuredRecipe-like minimal object. For full parsing prefer an external API.
 */
export async function fetchRecipeFromUrl(url: string): Promise<StructuredRecipe | null> {
  // Prefer Spoonacular extract endpoint via adapter when API key is configured
  try {
    const SpoonacularRecipeClient = await import('./spoonacularRecipeClient');
    const data = await SpoonacularRecipeClient.default.extractRecipeFromUrl(url);
    if (data) {
      const recipe: StructuredRecipe = {
        title: data.title || url,
        description: data.summary ? data.summary.replace(/<[^>]+>/g, '') : undefined,
        ingredients: (data.extendedIngredients || data.ingredients || []).map((ing: any) => (ing.originalString || `${ing.amount || ''} ${ing.unit || ''} ${ing.name || ''}`).trim()),
        instructions: (data.analyzedInstructions && data.analyzedInstructions[0] && data.analyzedInstructions[0].steps) ? data.analyzedInstructions[0].steps.map((s: any) => s.step) : (data.instructions ? data.instructions.replace(/<[^>]+>/g, '').split(/\n|<br>|<\/p>/).map((s: string) => s.trim()).filter(Boolean) : []),
        url: url,
        servings: data.servings,
        cookTimeMinutes: data.readyInMinutes,
        prepTimeMinutes: undefined,
        image: data.image || undefined
      } as any;
      return recipe;
    }
  } catch {
    // adapter failed or not present — fall back to naive parser
  }

  // Fallback naive HTML parsing using a CORS proxy to bypass browser restrictions
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    
    // Some test mocks return an object with `json()` but not `text()`.
    // Prefer `json()` when available and shape looks like a Spoonacular extract response.
    let text = '';
    if (typeof (res as any).json === 'function') {
      try {
        const maybeJson = await (res as any).json();
        if (maybeJson && (maybeJson.title || maybeJson.extendedIngredients || maybeJson.analyzedInstructions)) {
          const data = maybeJson;
          const recipe: StructuredRecipe = {
            title: data.title || url,
            description: data.summary ? data.summary.replace(/<[^>]+>/g, '') : undefined,
            ingredients: (data.extendedIngredients || data.ingredients || []).map((ing: any) => (ing.originalString || `${ing.amount || ''} ${ing.unit || ''} ${ing.name || ''}`).trim()),
            instructions: (data.analyzedInstructions && data.analyzedInstructions[0] && data.analyzedInstructions[0].steps) ? data.analyzedInstructions[0].steps.map((s: any) => s.step) : (data.instructions ? data.instructions.replace(/<[^>]+>/g, '').split(/\n|<br>|<\/p>/).map((s: string) => s.trim()).filter(Boolean) : []),
            url: url,
            servings: data.servings,
            cookTimeMinutes: data.readyInMinutes,
            prepTimeMinutes: undefined,
            image: data.image || undefined
          } as any;
          return recipe;
        }
        if (typeof (res as any).text === 'function') {
          text = await (res as any).text();
        } else {
          text = JSON.stringify(maybeJson || '');
        }
      } catch {
        if (typeof (res as any).text === 'function') {
          text = await (res as any).text();
        } else {
          text = '';
        }
      }
    } else {
      text = typeof (res as any).text === 'function' ? await (res as any).text() : '';
    }

    // Try to extract and parse JSON-LD Schema.org Recipe data
    try {
      const jsonLdMatches = Array.from(text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
      for (const match of jsonLdMatches) {
        try {
          const parsed = JSON.parse(match[1].trim());
          
          const findRecipe = (obj: any): any => {
            if (!obj) return null;
            if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) return obj;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const r = findRecipe(item);
                if (r) return r;
              }
            }
            if (obj['@graph'] && Array.isArray(obj['@graph'])) {
              for (const item of obj['@graph']) {
                const r = findRecipe(item);
                if (r) return r;
              }
            }
            return null;
          };

          const recipeData = findRecipe(parsed);
          if (recipeData) {
            const title = recipeData.name || recipeData.headline;
            const description = recipeData.description ? recipeData.description.replace(/<[^>]+>/g, '') : undefined;
            
            let ingredients: string[] = [];
            if (Array.isArray(recipeData.recipeIngredient)) {
              ingredients = recipeData.recipeIngredient;
            } else if (Array.isArray(recipeData.ingredients)) {
              ingredients = recipeData.ingredients;
            }

            let instructions: string[] = [];
            if (Array.isArray(recipeData.recipeInstructions)) {
              instructions = recipeData.recipeInstructions.map((step: any) => {
                if (typeof step === 'string') return step;
                if (step && typeof step === 'object') {
                  return step.text || step.name || '';
                }
                return '';
              }).filter(Boolean);
            } else if (typeof recipeData.recipeInstructions === 'string') {
              instructions = recipeData.recipeInstructions.split(/\n|<br>|<\/p>/).map((s: string) => s.trim()).filter(Boolean);
            }

            let image: string | undefined = undefined;
            if (recipeData.image) {
              if (typeof recipeData.image === 'string') {
                image = recipeData.image;
              } else if (Array.isArray(recipeData.image)) {
                image = recipeData.image[0];
              } else if (recipeData.image.url) {
                image = recipeData.image.url;
              }
            }

            let servings: number | undefined = undefined;
            if (recipeData.recipeYield) {
              const yieldStr = String(recipeData.recipeYield);
              const match = /\d+/.exec(yieldStr);
              if (match) servings = parseInt(match[0]);
            }

            let cookTimeMinutes: number | undefined = undefined;
            if (recipeData.cookTime) {
              const match = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(recipeData.cookTime);
              if (match) {
                const hours = parseInt(match[1] || '0');
                const minutes = parseInt(match[2] || '0');
                cookTimeMinutes = hours * 60 + minutes;
              }
            }

            if (title && (ingredients.length > 0 || instructions.length > 0)) {
              return {
                title,
                description,
                ingredients: ingredients.map(i => i.trim()).filter(Boolean),
                instructions: instructions.map(i => i.trim()).filter(Boolean),
                url,
                image,
                servings,
                cookTimeMinutes,
                cookTime: cookTimeMinutes ? `${cookTimeMinutes} mins` : '',
                prepTimeMinutes: undefined
              } as any;
            }
          }
        } catch {
          // Ignore individual JSON-LD parse errors
        }
      }
    } catch {
      // Ignore JSON-LD extraction errors
    }

    // Fallback to regex-based HTML parsing if no JSON-LD Recipe is found
    const titleMatch = /<title>(.*?)<\/title>/i.exec(text);
    const title = titleMatch ? titleMatch[1].trim() : url;
    const liMatches = Array.from(text.matchAll(/<li[^>]*>(.*?)<\/li>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const ingredients = liMatches.filter(t => /\d|cup|tsp|tbsp|g|kg|oz|ml/i.test(t)).slice(0, 100);
    const instructionsMatch = /<ol[^>]*>([\s\S]*?)<\/ol>/i.exec(text) || /<div[^>]*class=["']?instructions["']?[^>]*>([\s\S]*?)<\/div>/i.exec(text);
    const instructionsHtml = instructionsMatch ? instructionsMatch[1] : '';
    const steps = instructionsHtml ? instructionsHtml.replace(/<[^>]+>/g, '').split(/\n|<br>|<\/p>/).map(s => s.trim()).filter(Boolean) : [];

    const recipe: StructuredRecipe = {
      title,
      ingredients: ingredients.length > 0 ? ingredients : [],
      instructions: steps,
      url,
      servings: undefined,
      cookTimeMinutes: undefined,
      prepTimeMinutes: undefined
    } as any;

    return recipe;
  } catch (err) {
    log.warn('Failed to fetch/parse recipe URL', { err }, 'ImportService');
    return null;
  }
}

/**
 * Persist imported pantry items into the inventory cache for the current user/household.
 */
export async function persistImportedPantryItems(items: PantryItem[], householdId?: string, userId?: string) {
  // Use InventoryCacheService bulk add for efficiency
  await InventoryCacheService.addItemsToCache(items, householdId, userId);
}
