import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PantryItem, RecipeSearchResult, RecipeSearchParams, StructuredRecipe, User, GroundingChunk } from "../types";
// openRouterService removed — all AI calls go directly through Gemini
import { getPerformance, trace, PerformanceTrace } from "firebase/performance";
import { UsageService } from './usageService';

import remoteConfig from './remoteConfigService';
import { reportGeminiError } from './sentryService';
import { log } from './logService';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Guard performance initialization in test or uninitialized app environments
let performance: ReturnType<typeof getPerformance> | null = null;
try {
  performance = getPerformance();
} catch {
  // Firebase app may not be initialized in tests or certain environments
  performance = null;
}

/**
 * Analyzes an image to identify pantry items.
 */
export const analyzePantryImage = async (base64Image: string, mimeType: string, user?: User): Promise<PantryItem[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please check your environment variables.');
  }
  if (user?.isGuest) {
    throw new Error('AI features are not available in guest mode. Please sign in to use image scanning.');
  }

  const perfTrace = performance ? trace(performance, 'analyze_pantry_image') : null;
  perfTrace?.start();

  try {
    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          category: { type: Type.STRING },
          quantity_estimate: { type: Type.STRING },
        },
        required: ['item', 'category', 'quantity_estimate'],
      },
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Image analysis timed out. Please try again.')), 60000)
    );

    const responsePromise = ai.models.generateContent({
      model: remoteConfig.getString('gemini_model_vision'),
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: 'List every food or pantry item visible in this image. For each item provide its name, food category (e.g. Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Grains & Bread, Canned Goods, Snacks, Beverages, Spices & Herbs, Uncategorized), and estimated quantity.' },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const response = await Promise.race([responsePromise, timeoutPromise]) as { text: string };
    const jsonText = response.text;
    if (!jsonText) throw new Error('No data returned from Gemini.');

    const items = JSON.parse(
      jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    ) as PantryItem[];

    if (perfTrace) {
      perfTrace.putMetric('image_size_kb', Math.round(base64Image.length / 1024));
      perfTrace.putMetric('items_detected', items.length);
    }
    try { if (user) await UsageService.recordGeminiUsage(user); } catch { /* non-fatal */ }

    return items;
  } catch (err: unknown) {
    reportGeminiError('pantry_image_scan', err, {
      userId: user?.id,
      model: remoteConfig.getString('gemini_model_vision'),
      imageSizeKb: Math.round(base64Image.length / 1024),
    });
    throw err;
  } finally {
    perfTrace?.stop();
  }
};

/**
 * Analyzes a receipt image to extract grocery items.
 */
export const analyzeReceiptImage = async (base64Image: string, mimeType: string, user?: User): Promise<PantryItem[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please check your environment variables.');
  }
  if (user?.isGuest) {
    throw new Error('AI features are not available in guest mode. Please sign in to use receipt scanning.');
  }
  if (remoteConfig.getBoolean('kill_receiptScanning')) {
    throw new Error('Receipt scanning is temporarily disabled.');
  }

  const perfTrace = performance ? trace(performance, 'analyze_receipt_image') : null;
  perfTrace?.start();

  try {
    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          category: { type: Type.STRING },
          quantity_estimate: { type: Type.STRING },
        },
        required: ['item', 'category', 'quantity_estimate'],
      },
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Receipt analysis timed out. Please try again.')), 60000)
    );

    const responsePromise = ai.models.generateContent({
      model: remoteConfig.getString('gemini_model_vision'),
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: 'Extract all grocery/food items from this receipt. For each item provide its name, food category (e.g. Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Grains & Bread, Canned Goods, Snacks, Beverages, Household, Uncategorized), and quantity. Skip taxes, totals, subtotals, and store information.' },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const response = await Promise.race([responsePromise, timeoutPromise]) as { text: string };
    const jsonText = response.text;
    if (!jsonText) throw new Error('No data returned from Gemini.');

    const items = JSON.parse(
      jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    ) as PantryItem[];

    if (perfTrace) {
      perfTrace.putMetric('image_size_kb', Math.round(base64Image.length / 1024));
      perfTrace.putMetric('items_detected', items.length);
    }
    try { if (user) await UsageService.recordGeminiUsage(user); } catch { /* non-fatal */ }

    return items;
  } catch (err: unknown) {
    reportGeminiError('receipt_image_scan', err, {
      userId: user?.id,
      model: remoteConfig.getString('gemini_model_vision'),
      imageSizeKb: Math.round(base64Image.length / 1024),
    });
    throw err;
  } finally {
    perfTrace?.stop();
  }
};

/**
 * Searches for recipes using Google Search Grounding with enhanced filters and structured JSON output.
 */
export const searchRecipes = async (params: RecipeSearchParams, user?: User): Promise<RecipeSearchResult> => {
  const perfTrace = performance ? trace(performance, 'search_recipes') : null;
  perfTrace?.start();

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait with exponential backoff on retries
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        log.debug(`Retrying Gemini request in ${delay}ms (attempt ${attempt}/${maxRetries})`, {}, 'GeminiService');
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await performSearch(params, user, perfTrace);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on 429/rate limit errors
      const errMsg = lastError.message;
      if (attempt < maxRetries && (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('Resource exhausted'))) {
        log.warn(`Gemini rate limit hit, retrying (attempt ${attempt + 1}/${maxRetries}):`, { errMsg }, 'GeminiService');
        continue;
      }

      // For other errors or max retries reached, throw the error
      throw err;
    }
  }

  throw lastError;
};

// Internal function to perform the actual search
const performSearch = async (params: RecipeSearchParams, user: User | undefined, perfTrace: PerformanceTrace | null): Promise<RecipeSearchResult> => {
  try {
    if (user?.isGuest) {
      throw new Error('AI features are not available in guest mode. Please sign in to search recipes.');
    }
    const modelId = remoteConfig.getString('gemini_model');
  
  // Check if API key is available
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please check your environment variables.');
  }
  
  let prompt = "";

  // Use short keys to minimize output tokens. Map: t=title, d=description, i=ingredients, s=steps, c=cookTime
  const jsonFormat = `{"r":[{"t":"title","d":"short desc","i":["qty ingredient"],"s":["step"],"c":"15 min"}]}`;

  if (params.query) {
    prompt = `2 recipes for "${params.query}". Reply JSON: ${jsonFormat}`;
    if (params.restrictions) prompt += `. Diet: ${params.restrictions}`;
  } else {
    const limitedIngredients = params.ingredients.split(', ').slice(0, 20).join(', ');
    prompt = `2 recipes from: ${limitedIngredients}. Reply JSON: ${jsonFormat}`;

    if (params.strictMode) {
      prompt += `. Only these + basics`;
    }

    if (params.restrictions) prompt += `. Diet: ${params.restrictions}`;
    if (params.maxCookTime) prompt += `. Max ${params.maxCookTime}min`;
    if (params.maxIngredients) prompt += `. Max ${params.maxIngredients} ingr`;
  }

  prompt += `. ${params.measurementSystem}. Brief steps.`;

  try {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout. Please try again.')), 60000); // 60 second timeout
    });

    const responsePromise = ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
      },
    });

const response = await Promise.race([responsePromise, timeoutPromise]) as { text: string; candidates?: Array<{ finishReason?: string; groundingMetadata?: { groundingChunks?: unknown[] } }> };

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      log.warn(`Gemini finish_reason: ${finishReason} — response may be truncated`, {}, 'GeminiService');
    }
    const jsonText = response.text;
    let recipes: StructuredRecipe[] = [];
    
    if (jsonText) {
      // Clean up markdown if present
      const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      
      try {
        const parsed = JSON.parse(cleanJson);
        // Map short keys back to StructuredRecipe fields
        const rawRecipes = parsed.r || parsed.recipes || [];
        recipes = rawRecipes.map((r: Record<string, unknown>) => ({
          title: r.t || r.title || '',
          description: r.d || r.description || '',
          ingredients: r.i || r.ingredients || [],
          instructions: r.s || r.instructions || [],
          cookTime: r.c || r.cookTime || '',
        } as StructuredRecipe));
      } catch (jsonError) {
        log.warn('JSON Parse Error, attempting to extract JSON from text:', { jsonError }, 'GeminiService');
        
        // Try to extract JSON from the text response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const rawRecipes = parsed.r || parsed.recipes || [];
            recipes = rawRecipes.map((r: Record<string, unknown>) => ({
              title: r.t || r.title || '',
              description: r.d || r.description || '',
              ingredients: r.i || r.ingredients || [],
              instructions: r.s || r.instructions || [],
              cookTime: r.c || r.cookTime || '',
            } as StructuredRecipe));
          } catch (extractError) {
            log.warn('Failed to extract JSON, falling back to text parsing:', { extractError }, 'GeminiService');
            recipes = parseNaturalLanguageRecipes(jsonText);
          }
        } else {
          log.warn('No JSON found in response, falling back to text parsing', {}, 'GeminiService');
          recipes = parseNaturalLanguageRecipes(jsonText);
        }
      }
    } else {
      log.warn('Gemini returned no text for recipe search.', {}, 'GeminiService');
    }

    // Add custom metrics (if performance available)
    if (perfTrace) {
      perfTrace.putMetric('query_length', Number(params.query?.length || 0));
      perfTrace.putMetric('ingredients_count', Number(params.ingredients?.split(', ').length || 0));
      perfTrace.putMetric('recipes_returned', Number(recipes.length));
      perfTrace.putAttribute('search_mode', params.query ? 'specific' : 'pantry_based');
      perfTrace.putAttribute('strict_mode', params.strictMode ? 'true' : 'false');
    }

    // Record usage in Firebase only if we got actual results
    if (recipes.length > 0 && user) {
      try {
        await UsageService.recordGeminiUsage(user);
      } catch (e) {
        log.warn('Failed to record Gemini usage:', { e }, 'GeminiService');
      }
    }

    return {
      recipes: recipes,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined,
    };
  } catch (timeoutError) {
    log.error('Request timeout or API error:', { timeoutError }, 'GeminiService');
    throw timeoutError;
  }

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('Error searching recipes:', { err }, 'GeminiService');
    reportGeminiError('recipe_search', err, {
      userId: user?.id,
      model: remoteConfig.getString('gemini_model'),
      query: params.query,
    });

    // Provide more specific error messages
    if (errMsg.includes('API_KEY')) {
      throw new Error('API configuration error. Please check your Gemini API key.');
    } else if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('Resource exhausted')) {
      throw new Error('API rate limit exceeded. Please wait a moment and try again.');
    } else if (errMsg.includes('quota') || errMsg.includes('limit')) {
      throw new Error('API quota exceeded. Please try again later.');
    } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error(`Recipe search failed: ${errMsg}`);
    }
  } finally {
    perfTrace?.stop();
  }
};

/**
 * Fallback parser for natural language recipe responses when JSON parsing fails
 */
function parseNaturalLanguageRecipes(text: string): StructuredRecipe[] {
  const recipes: StructuredRecipe[] = [];
  
  try {
    // Split text into potential recipe sections
    const sections = text.split(/\n\s*(?=Recipe \d+|^\d+\.|Title:|Here are)/mi);
    
    for (const section of sections.slice(0, 2)) { // Limit to 2 recipes
      const recipe: Partial<StructuredRecipe> = {};
      
      // Extract title
      const titleMatch = section.match(/(?:Recipe \d+:?\s*|Title:\s*)([^\n]+)/i) || 
                        section.match(/^([^\n]+?)(?:\n|$)/);
      if (titleMatch) {
        recipe.title = titleMatch[1].trim();
      }
      
      // Extract description/summary
      const descMatch = section.match(/(?:Description|Summary):\s*([^\n]+)/i);
      if (descMatch) {
        recipe.description = descMatch[1].trim();
      }
      
      // Extract ingredients
      const ingredientsSection = section.match(/(?:Ingredients?:?\s*)(.*?)(?:\n\s*(?:Instructions?|Steps?|Directions?))/is);
      if (ingredientsSection) {
        const ingredientsText = ingredientsSection[1];
        recipe.ingredients = ingredientsText
          .split(/\n-|\n\d+\.|\n•/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.match(/^\s*$/))
          .slice(0, 10); // Limit ingredients
      }
      
      // Extract instructions
      const instructionsSection = section.match(/(?:Instructions?|Steps?|Directions?:?\s*)(.*?)(?:\n\s*(?:Cook time|Time|Prep)|$)/is);
      if (instructionsSection) {
        const instructionsText = instructionsSection[1];
        recipe.instructions = instructionsText
          .split(/\n\d+\.|\n-|\n•/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.match(/^\s*$/))
          .slice(0, 5); // Limit steps
      }
      
      // Extract cook time
      const timeMatch = section.match(/(?:Cook time|Time|Prep time):\s*([^\n]+)/i);
      if (timeMatch) {
        recipe.cookTime = timeMatch[1].trim();
      }
      
      // Only add recipe if we have at least a title
      if (recipe.title) {
        recipes.push(recipe as StructuredRecipe);
      }
    }
    
    // If no recipes were parsed, create a fallback
    if (recipes.length === 0) {
      recipes.push({
        title: "Recipe Search Result",
        description: "Please try rephrasing your search or check your ingredients",
        ingredients: ["Ingredients not available"],
        instructions: ["Instructions not available"],
        cookTime: "Unknown"
      });
    }
    
  } catch (err: unknown) {
    log.error('Error parsing natural language recipes:', { err }, 'GeminiService');
    // Return a basic fallback recipe
    recipes.push({
      title: "Search Error",
      description: "Unable to parse recipe results. Please try again.",
      ingredients: ["Please try a different search"],
      instructions: ["Please try again"],
      cookTime: "Unknown"
    });
  }
  
  return recipes;
}


