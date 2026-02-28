import { PantryItem, StructuredRecipe } from '../types';
import { InventoryCacheService } from './inventoryCacheService';
import DatabaseMonitoringService from './databaseMonitoringService';

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
  } catch (err) {
    // adapter failed or not present — fall back to naive parser
  }

  // Fallback naive HTML parsing
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
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
    console.warn('Failed to fetch/parse recipe URL', err);
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
