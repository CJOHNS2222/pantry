/**
 * OpenRouter (and Groq) service for recipe text search.
 *
 * Both use an OpenAI-compatible REST API, so the same client works for either:
 *   OpenRouter: VITE_OPENROUTER_BASE_URL defaults to https://openrouter.ai/api/v1
 *   Groq:       set VITE_OPENROUTER_BASE_URL=https://api.groq.com/openai/v1
 *               and VITE_OPENROUTER_API_KEY to your Groq key
 *
 * Model selection (in priority order):
 *   1. VITE_OPENROUTER_MODEL env var
 *   2. DEFAULT_MODEL constant below
 *
 * To enable: add to .env.local:
 *   VITE_OPENROUTER_API_KEY=<your key>
 *   VITE_GEMINI_DISABLED=true   (routes searchRecipes calls here instead of Gemini)
 *
 * Optional:
 *   VITE_OPENROUTER_BASE_URL=https://api.groq.com/openai/v1
 *   VITE_OPENROUTER_MODEL=llama-3.3-70b-versatile
 */

import { RecipeSearchParams, RecipeSearchResult, StructuredRecipe, User, PantryItem } from '../types';
import { log } from './logService';
import remoteConfig from './remoteConfigService';
import { getUserNutritionTargets, generatePersonalizedSearchPrompt } from '../utils/nutritionUtils';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

// ---- Prompt builder (mirrors performSearch in geminiService.ts) ----------------

function buildPrompt(params: RecipeSearchParams): string {
  const macroTargets = params.userProfile ? getUserNutritionTargets(params.userProfile) : null;

  // Same compact JSON format used by Gemini to keep prompts comparable
  const jsonFormat = `{"r":[{"t":"title","d":"short desc","i":["qty ingredient"],"s":["step"],"c":"15 min"}]}`;

  let prompt = '';

  if (params.query) {
    prompt = `2 recipes for "${params.query}". Reply JSON: ${jsonFormat}`;
    if (params.restrictions) prompt += `. Diet: ${params.restrictions}`;
  } else {
    const limitedIngredients = params.ingredients.split(', ').slice(0, 20).join(', ');
    prompt = `2 recipes from: ${limitedIngredients}. Reply JSON: ${jsonFormat}`;
    if (params.strictMode) prompt += `. Only these + basics`;
    if (params.restrictions) prompt += `. Diet: ${params.restrictions}`;
    if (params.maxCookTime) prompt += `. Max ${params.maxCookTime}min`;
    if (params.maxIngredients) prompt += `. Max ${params.maxIngredients} ingr`;
  }

  prompt += `. ${params.measurementSystem}. Brief steps.`;

  if (params.userProfile) {
    prompt = generatePersonalizedSearchPrompt(prompt, params.userProfile, macroTargets || undefined);
  }

  return prompt;
}

// ---- JSON parser (mirrors performSearch parsing in geminiService.ts) -----------

function parseRecipesFromText(text: string): StructuredRecipe[] {
  const cleanJson = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  const tryParse = (raw: string): StructuredRecipe[] | null => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const rawRecipes = (parsed.r || parsed.recipes || []) as Array<Record<string, unknown>>;
      if (!Array.isArray(rawRecipes) || rawRecipes.length === 0) return null;
      return rawRecipes.map((r) => ({
        title:        (r.t || r.title || '') as string,
        description:  (r.d || r.description || '') as string,
        ingredients:  (r.i || r.ingredients || []) as string[],
        instructions: (r.s || r.instructions || []) as string[],
        cookTime:     (r.c || r.cookTime || '') as string,
      } as StructuredRecipe));
    } catch {
      return null;
    }
  };

  // First try the cleaned text directly
  const direct = tryParse(cleanJson);
  if (direct) return direct;

  // Fall back to extracting the first JSON object from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const extracted = tryParse(jsonMatch[0]);
    if (extracted) return extracted;
  }

  return [];
}

// ---- Public API ---------------------------------------------------------------

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

export async function searchRecipesViaOpenRouter(
  params: RecipeSearchParams,
  // user is accepted but not used for rate-limiting — this is a test/bypass path
  _user?: User
): Promise<RecipeSearchResult> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your .env.local file.'
    );
  }

  const baseUrl = (import.meta.env.VITE_OPENROUTER_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;
  // env var wins (local dev override); Remote Config provides production hot-swap
  const model   = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined)
                  || remoteConfig.getString('openrouter_model');
  const prompt  = buildPrompt(params);

  log.debug('OpenRouter recipe search', {
    model,
    baseUrl,
    query: params.query ?? '(pantry-based)',
    ingredientCount: params.ingredients.split(', ').length,
  }, 'OpenRouterService');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        // OpenRouter requires these headers to identify the calling app
        'HTTP-Referer':  'https://stockandspoon.app',
        'X-Title':       'Stock & Spoon',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role:    'system',
            content: 'You are a cooking assistant. Reply with valid JSON only — no markdown, no prose.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens:  900,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log.error('OpenRouter API error', { status: response.status, errorBody }, 'OpenRouterService');
    throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as OpenRouterChatResponse;

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('OpenRouter returned an empty response.');
  }

  log.debug('OpenRouter response', { model, contentLength: content.length }, 'OpenRouterService');
  console.log(`[OpenRouter] Model: ${model} | Response length: ${content.length}`);
  console.log(`[OpenRouter] Raw: ${content.substring(0, 300)}`);

  const recipes = parseRecipesFromText(content);

  if (recipes.length === 0) {
    console.warn('[OpenRouter] Could not parse any recipes from response. Raw:', content.substring(0, 500));
    throw new Error('AI returned a response that could not be parsed into recipes. Try rephrasing your search or adjusting your ingredients.');
  }

  return { recipes };
}

// ---- Vision: shared fetch helper -----------------------------------------------

async function callVisionModel(
  base64Image: string,
  mimeType: string,
  textPrompt: string,
  logTag: string,
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not configured. Add VITE_OPENROUTER_API_KEY to your .env.local file.'
    );
  }

  const baseUrl = (import.meta.env.VITE_OPENROUTER_BASE_URL as string | undefined) ?? DEFAULT_BASE_URL;
  // env var wins (local dev override); Remote Config provides production hot-swap
  const model   = (import.meta.env.VITE_OPENROUTER_VISION_MODEL as string | undefined)
                  || remoteConfig.getString('openrouter_vision_model');

  log.debug(`${logTag}: calling vision model`, {
    model, baseUrl, imageSizeKB: Math.round(base64Image.length / 1024), mimeType,
  }, 'OpenRouterService');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://stockandspoon.app',
        'X-Title':       'Stock & Spoon',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role:    'system',
            content: 'You are a food/grocery expert. Reply with valid JSON only — no markdown, no prose.',
          },
          {
            role: 'user',
            content: [
              {
                type:      'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              { type: 'text', text: textPrompt },
            ],
          },
        ],
        temperature: 0.2,   // low temperature for factual image-based extraction
        max_tokens:  1500,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log.error(`${logTag}: API error`, { status: response.status, errorBody }, 'OpenRouterService');
    throw new Error(`OpenRouter vision API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as OpenRouterChatResponse;
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenRouter vision returned an empty response.');

  console.log(`[OpenRouter/${logTag}] Model: ${model} | Response length: ${content.length}`);
  console.log(`[OpenRouter/${logTag}] Raw: ${content.substring(0, 300)}`);

  return content;
}

function parseJsonArray<T>(text: string): T[] {
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  const tryParse = (s: string): T[] | null => {
    try {
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  };

  return tryParse(clean)
    ?? tryParse(clean.match(/\[[\s\S]*\]/)?.[0] ?? '')
    ?? [];
}

// ---- Vision: pantry image -------------------------------------------------------

const PANTRY_PROMPT =
  'List all pantry items visible as a JSON array: ' +
  '[{"item":"name","category":"cat","quantity_estimate":"est"},...]. ' +
  'Categories: Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Seafood, Grains & Bread, ' +
  'Canned Goods, Condiments & Sauces, Snacks, Beverages, Frozen Foods, Baking Supplies, ' +
  'Spices & Herbs, Breakfast Foods, Uncategorized.';

export async function analyzePantryImageViaOpenRouter(
  base64Image: string,
  mimeType: string,
  _user?: User,
): Promise<PantryItem[]> {
  const text = await callVisionModel(base64Image, mimeType, PANTRY_PROMPT, 'analyzePantry');
  const items = parseJsonArray<PantryItem>(text);

  if (items.length === 0) {
    console.warn('[OpenRouter/analyzePantry] No items parsed. Raw:', text.substring(0, 500));
    throw new Error('No pantry items could be identified from the image. Try a clearer photo with better lighting.');
  }
  console.log(`[OpenRouter/analyzePantry] Parsed ${items.length} items`);

  return items;
}

// ---- Vision: receipt image -------------------------------------------------------

const RECEIPT_PROMPT =
  'Extract grocery items from this receipt as a JSON array: ' +
  '[{"item":"name","category":"cat","quantity_estimate":"qty","estimatedPrice":0.00,' +
  '"priceOptions":[{"amount":1,"unit":"each","price":0.00}]},...]. ' +
  'For the same item with multiple sizes/prices use separate priceOptions entries. ' +
  'Categories: Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Seafood, Grains & Bread, ' +
  'Canned Goods, Condiments & Sauces, Snacks, Beverages, Frozen Foods, Baking Supplies, ' +
  'Spices & Herbs, Breakfast Foods, Household, Uncategorized. ' +
  'Skip taxes, totals, and store info.';

export async function analyzeReceiptImageViaOpenRouter(
  base64Image: string,
  mimeType: string,
  _user?: User,
): Promise<PantryItem[]> {
  const text = await callVisionModel(base64Image, mimeType, RECEIPT_PROMPT, 'analyzeReceipt');
  const items = parseJsonArray<PantryItem>(text);

  if (items.length === 0) {
    console.warn('[OpenRouter/analyzeReceipt] No items parsed. Raw:', text.substring(0, 500));
    throw new Error('No receipt items could be identified from the image. Try a clearer, well-lit photo of the receipt.');
  }
  console.log(`[OpenRouter/analyzeReceipt] Parsed ${items.length} items`);

  return items;
}
