import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PantryItem, RecipeSearchResult, RecipeSearchParams, StructuredRecipe, User, GroundingChunk } from "../types";
import { getPerformance, trace, PerformanceTrace } from "firebase/performance";
import featureFlags from './featureFlags';
import { UsageService } from './usageService';
import { log } from './logService';
import { getUserNutritionTargets, generatePersonalizedSearchPrompt } from '../utils/nutritionUtils';
import remoteConfig from './remoteConfigService';

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

// Request batching and debouncing system
interface QueuedRequest<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  timestamp: number;
  priority: number; // Higher priority = processed first
}

class GeminiRequestBatcher {
  private queue: QueuedRequest<unknown>[] = [];
  private isProcessing = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private get debounceDelay() { return remoteConfig.getNumber('gemini_debounce_delay_ms'); }
  private get maxBatchSize() { return remoteConfig.getNumber('gemini_max_batch_size'); }
  private readonly maxQueueSize = 10; // Maximum queue size
  private requestCache = new Map<string, { result: unknown; timestamp: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly maxCacheSize = 100; // Maximum cache entries

  // Debounced processing
  private scheduleProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.debounceDelay);
  }

  // Process queued requests
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Sort by priority (higher first) then by timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Take up to maxBatchSize requests
      const batch = this.queue.splice(0, this.maxBatchSize);

      log.info(`Processing Gemini batch: ${batch.length} requests`, {}, 'GeminiBatcher');

      // Process batch concurrently
      const promises = batch.map(async (request) => {
        try {
          const result = await request.operation();
          request.resolve(result);
          log.debug(`Completed Gemini request: ${request.id}`, {}, 'GeminiBatcher');
        } catch (err: unknown) {
          log.error(`Failed Gemini request: ${request.id}`, err, 'GeminiBatcher');
        }
      });

      await Promise.allSettled(promises);

    } finally {
      this.isProcessing = false;

      // Process remaining items if any
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  // Add request to queue
  async enqueue<T>(
    id: string,
    operation: () => Promise<T>,
    priority: number = 1
  ): Promise<T> {
    // Check cache first
    const cached = this.requestCache.get(id);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      log.debug(`Using cached Gemini result for: ${id}`, {}, 'GeminiBatcher');
      return cached.result as T;
    }

    return new Promise<T>((resolve, reject) => {
      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Gemini request queue is full. Please try again later.'));
        return;
      }

      const request: QueuedRequest<T> = {
        id,
        operation,
        resolve: (result) => {
          // Cache successful results with eviction
          this.setCacheEntry(id, result);
          resolve(result);
        },
        reject,
        timestamp: Date.now(),
        priority
      };

      this.queue.push(request as QueuedRequest<unknown>);
      log.debug(`Queued Gemini request: ${id} (priority: ${priority})`, {}, 'GeminiBatcher');

      this.scheduleProcessing();
    });
  }

  // Clear cache
  clearCache(): void {
    this.requestCache.clear();
    log.info('Cleared Gemini request cache', {}, 'GeminiBatcher');
  }

  // Set cache entry with eviction
  private setCacheEntry(id: string, result: unknown): void {
    // Evict oldest entries if at max size
    if (this.requestCache.size >= this.maxCacheSize) {
      const entries = Array.from(this.requestCache.entries());
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // Remove oldest 10% or at least 1 entry
      const toRemove = Math.max(1, Math.floor(this.maxCacheSize * 0.1));
      for (let i = 0; i < toRemove && entries.length > 0; i++) {
        this.requestCache.delete(entries[i][0]);
      }
      log.debug(`Evicted ${toRemove} old cache entries`, {}, 'GeminiBatcher');
    }

    this.requestCache.set(id, { result, timestamp: Date.now() });
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      cacheSize: this.requestCache.size
    };
  }
}

// Create singleton batcher
const geminiBatcher = new GeminiRequestBatcher();

/**
 * Analyzes an image to identify pantry items.
 */
export const analyzePantryImage = async (base64Image: string, mimeType: string, user?: User): Promise<PantryItem[]> => {
  // Gate Gemini usage: ensure global enabled + user opt-in + usage cap
  log.debug('analyzePantryImage: entry', {
    userId: user?.id ?? 'none',
    isGuest: user?.isGuest ?? false,
    imageSizeKB: Math.round(base64Image.length / 1024),
    mimeType,
    apiKeyPresent: !!import.meta.env.VITE_GEMINI_API_KEY,
    geminiGloballyEnabled: featureFlags.isGeminiGloballyEnabled(),
    userOptedIn: user?.id ? featureFlags.userOptedInToGemini(user.id) : false,
    visionModel: remoteConfig.getString('gemini_model_vision'),
  }, 'GeminiService');

  if (!featureFlags.isGeminiGloballyEnabled()) {
    throw new Error('Gemini integration is disabled by configuration.');
  }

  if (!user?.id) {
    throw new Error('User authentication required for Gemini usage.');
  }

  if (user.isGuest) {
    throw new Error('AI features are not available in guest mode. Please sign up for a free account.');
  }

  // Note: we expect the caller to set user opt-in before invoking this in UI flows.
  if (!featureFlags.userOptedInToGemini(user.id)) {
    throw new Error('Gemini usage not permitted: opt-in required.');
  }

  // Check Firebase usage limits
  if (!(await UsageService.canUseGemini(user))) {
    log.debug('analyzePantryImage: usage limit gate failed', { userId: user?.id }, 'GeminiService');
    throw new Error('Gemini usage not permitted: weekly limit reached.');
  }

  // Create cache key based on image hash (simple hash for demo)
  const imageHash = btoa(base64Image).slice(0, 16);
  const requestId = `pantry_analysis_${user.id}_${imageHash}`;
  log.debug('analyzePantryImage: gates passed, enqueueing', { requestId }, 'GeminiService');

  return geminiBatcher.enqueue(requestId, async () => {
    const perfTrace = performance ? trace(performance, 'analyze_pantry_image') : null;
    perfTrace?.start();

    try {
      // Check API key first
      if (!import.meta.env.VITE_GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured. Please check your environment variables.');
      }

      console.log('🔍 Starting pantry image analysis with model:', remoteConfig.getString('gemini_model_vision'));
      console.log('📊 Image size:', Math.round(base64Image.length / 1024), 'KB');

      const modelId = remoteConfig.getString('gemini_model_vision');

      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING },
            category: { type: Type.STRING },
            quantity_estimate: { type: Type.STRING },
          },
          required: ["item", "category", "quantity_estimate"],
        },
      };

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image analysis timeout. Please try again.')), 40000); // 40 second timeout for image analysis
      });

      const responsePromise = ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: `List all pantry items visible. Categories: Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Seafood, Grains & Bread, Canned Goods, Condiments & Sauces, Snacks, Beverages, Frozen Foods, Baking Supplies, Spices & Herbs, Breakfast Foods, Uncategorized.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 1200,
        },
      });

      const response = await Promise.race([responsePromise, timeoutPromise]) as { text: string };
      console.log('✅ Pantry image analysis API call completed');

      const jsonText = response.text;
      console.log('📄 Pantry response text length:', jsonText?.length || 0);
      
      if (!jsonText) {
        console.error('❌ No text in pantry Gemini response');
        throw new Error("No data returned from Gemini.");
      }

      console.log('🔧 Pantry raw response text:', jsonText.substring(0, 200) + '...');

      const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      console.log('🧹 Pantry cleaned JSON length:', cleanJson.length);
      
      let items;
      try {
        items = JSON.parse(cleanJson) as PantryItem[];
        console.log('✅ Pantry successfully parsed', items.length, 'items');
      } catch (parseError) {
        console.error('❌ Pantry JSON parse error:', parseError);
        console.error('❌ Pantry failed to parse:', cleanJson.substring(0, 500));
        throw new Error(`Failed to parse Gemini response: ${parseError}`);
      }

      // Add custom metrics (if performance available)
      if (perfTrace) {
        perfTrace.putMetric('image_size_kb', Math.round(base64Image.length / 1024));
        perfTrace.putMetric('items_detected', Number(items.length));
      }

      // Record usage in Firebase
      try {
        await UsageService.recordGeminiUsage(user);
      } catch (e) {
        console.warn('Failed to record Gemini usage:', e);
      }

      return items;
    } catch (err: unknown) {
      console.error("Error analyzing pantry image:", err);
      throw err;
    } finally {
      perfTrace?.stop();
    }
  }, 2); // Higher priority for image analysis
};

/**
 * Analyzes a receipt image to extract grocery items and their details.
 */
export const analyzeReceiptImage = async (base64Image: string, mimeType: string, user?: User): Promise<PantryItem[]> => {
  // Gate Gemini usage: ensure global enabled + user opt-in + usage cap
  log.debug('analyzeReceiptImage: entry', {
    userId: user?.id ?? 'none',
    isGuest: user?.isGuest ?? false,
    imageSizeKB: Math.round(base64Image.length / 1024),
    mimeType,
    apiKeyPresent: !!import.meta.env.VITE_GEMINI_API_KEY,
    geminiGloballyEnabled: featureFlags.isGeminiGloballyEnabled(),
    receiptScanKillSwitch: remoteConfig.getBoolean('kill_receiptScanning'),
    userOptedIn: user?.id ? featureFlags.userOptedInToGemini(user.id) : false,
    visionModel: remoteConfig.getString('gemini_model_vision'),
  }, 'GeminiService');

  if (!featureFlags.isGeminiGloballyEnabled()) {
    throw new Error('Gemini integration is disabled by configuration.');
  }

  if (remoteConfig.getBoolean('kill_receiptScanning')) {
    throw new Error('Receipt scanning is temporarily disabled by configuration.');
  }

  if (!user?.id) {
    throw new Error('User authentication required for Gemini usage.');
  }

  if (user.isGuest) {
    throw new Error('AI features are not available in guest mode. Please sign up for a free account.');
  }

  // Note: we expect the caller to set user opt-in before invoking this in UI flows.
  if (!featureFlags.userOptedInToGemini(user.id)) {
    throw new Error('Gemini usage not permitted: opt-in required.');
  }

  // Check Firebase usage limits
  if (!(await UsageService.canUseGemini(user))) {
    log.debug('analyzeReceiptImage: usage limit gate failed', { userId: user?.id }, 'GeminiService');
    throw new Error('Gemini usage not permitted: weekly limit reached.');
  }

  // Create cache key based on image hash (simple hash for demo)
  const imageHash = btoa(base64Image).slice(0, 16);
  const requestId = `receipt_analysis_${user.id}_${imageHash}`;
  log.debug('analyzeReceiptImage: gates passed, enqueueing', { requestId }, 'GeminiService');

  return geminiBatcher.enqueue(requestId, async () => {
    const perfTrace = performance ? trace(performance, 'analyze_receipt_image') : null;
    perfTrace?.start();

    try {
      console.log('🔍 Starting receipt image analysis with model:', remoteConfig.getString('gemini_model_vision'));
      console.log('📊 Image size:', Math.round(base64Image.length / 1024), 'KB');

      const modelId = remoteConfig.getString('gemini_model_vision');

      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING },
            category: { type: Type.STRING },
            quantity_estimate: { type: Type.STRING },
            estimatedPrice: { type: Type.NUMBER },
            priceOptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
                required: ["amount", "unit", "price"],
              },
            },
          },
          required: ["item", "category", "quantity_estimate"],
        },
      };

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Receipt analysis timeout. Please try again.')), 40000); // 40 second timeout for image analysis
      });

      const responsePromise = ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: `Extract grocery items from this receipt. Include item name, price, and quantity. For same items with multiple sizes/prices, use separate priceOptions entries. Categories: Fruits & Vegetables, Dairy & Eggs, Meat & Poultry, Seafood, Grains & Bread, Canned Goods, Condiments & Sauces, Snacks, Beverages, Frozen Foods, Baking Supplies, Spices & Herbs, Breakfast Foods, Household, Uncategorized. Skip taxes, totals, and store info.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 1500,
        },
      });

      const response = await Promise.race([responsePromise, timeoutPromise]) as { text: string };

      const jsonText = response.text;
      console.log('✅ Receipt image analysis API call completed');
      console.log('📄 Receipt response text length:', jsonText?.length || 0);

      if (!jsonText) {
        console.error('❌ No text in receipt Gemini response');
        throw new Error("No data returned from Gemini.");
      }

      console.log('🔧 Receipt raw response text:', jsonText.substring(0, 200) + '...');

      const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      console.log('🧹 Receipt cleaned JSON length:', cleanJson.length);

      let items;
      try {
        items = JSON.parse(cleanJson) as PantryItem[];
        console.log('✅ Receipt successfully parsed', items.length, 'items');
      } catch (parseError) {
        console.error('❌ Receipt JSON parse error:', parseError);
        console.error('❌ Receipt failed to parse:', cleanJson.substring(0, 500));
        throw new Error(`Failed to parse Gemini response: ${parseError}`);
      }

      // Add custom metrics (if performance available)
      if (perfTrace) {
        perfTrace.putMetric('image_size_kb', Math.round(base64Image.length / 1024));
        perfTrace.putMetric('items_detected', Number(items.length));
      }

      // Record usage in Firebase
      try {
        await UsageService.recordGeminiUsage(user);
      } catch (e) {
        console.warn('Failed to record Gemini usage:', e);
      }

      return items;
    } catch (err: unknown) {
      console.error("Error analyzing receipt image:", err);
      throw err;
    } finally {
      perfTrace?.stop();
    }
  }, 2); // Higher priority for image analysis
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
        console.log(`Retrying Gemini request in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await performSearch(params, user, perfTrace);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on 429/rate limit errors
      const errMsg = lastError.message;
      if (attempt < maxRetries && (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('Resource exhausted'))) {
        console.warn(`Gemini rate limit hit, retrying (attempt ${attempt + 1}/${maxRetries}):`, errMsg);
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
    // Gate Gemini usage for recipe search as well
    if (!featureFlags.isGeminiGloballyEnabled()) {
      throw new Error('Gemini integration is disabled by configuration.');
    }

    if (!user?.id) {
      throw new Error('User authentication required for Gemini usage.');
    }

    if (user.isGuest) {
      throw new Error('AI features are not available in guest mode. Please sign up for a free account.');
    }

    // Note: we expect the caller to set user opt-in before invoking this in UI flows.
    if (!featureFlags.userOptedInToGemini(user.id)) {
      throw new Error('Gemini usage not permitted: opt-in required.');
    }

    // Check Firebase usage limits
    if (!(await UsageService.canUseGemini(user))) {
      throw new Error('Gemini usage not permitted: weekly limit reached.');
    }
    const modelId = remoteConfig.getString('gemini_model');
  
  // Check if API key is available
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please check your environment variables.');
  }
  
  let prompt = "";

  // Get user nutrition targets if profile is available
  const macroTargets = params.userProfile ? getUserNutritionTargets(params.userProfile) : null;

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

  // Apply personalized prompt modifications based on user profile
  if (params.userProfile) {
    prompt = generatePersonalizedSearchPrompt(prompt, params.userProfile, macroTargets || undefined);
  }

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
      console.warn(`Gemini finish_reason: ${finishReason} — response may be truncated`);
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
        console.warn("JSON Parse Error, attempting to extract JSON from text:", jsonError);
        
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
            console.warn("Failed to extract JSON, falling back to text parsing:", extractError);
            recipes = parseNaturalLanguageRecipes(jsonText);
          }
        } else {
          console.warn("No JSON found in response, falling back to text parsing");
          recipes = parseNaturalLanguageRecipes(jsonText);
        }
      }
    } else {
      console.warn('Gemini returned no text for recipe search.');
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
    if (recipes.length > 0) {
      try {
        await UsageService.recordGeminiUsage(user);
      } catch (e) {
        console.warn('Failed to record Gemini usage:', e);
      }
    }

    return {
      recipes: recipes,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined,
    };
  } catch (timeoutError) {
    console.error("Request timeout or API error:", timeoutError);
    throw timeoutError;
  }

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Error searching recipes:", err);

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
    console.error("Error parsing natural language recipes:", err);
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


