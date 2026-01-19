import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PantryItem, RecipeSearchResult, RecipeSearchParams, StructuredRecipe } from "../types";
import { getPerformance, trace } from "firebase/performance";
import featureFlags from './featureFlags';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Guard performance initialization in test or uninitialized app environments
let performance: ReturnType<typeof getPerformance> | null = null;
try {
  performance = getPerformance();
} catch (e) {
  // Firebase app may not be initialized in tests or certain environments
  performance = null;
}

/**
 * Analyzes an image to identify pantry items.
 */
export const analyzePantryImage = async (base64Image: string, mimeType: string): Promise<PantryItem[]> => {
  // Gate Gemini usage: ensure global enabled + user opt-in + usage cap
  if (!featureFlags.isGeminiGloballyEnabled()) {
    throw new Error('Gemini integration is disabled by configuration.');
  }

  // Note: we expect the caller to set user opt-in before invoking this in UI flows.
  if (!featureFlags.canUseGemini(undefined)) {
    throw new Error('Gemini usage not permitted: opt-in required or daily cap reached.');
  }

  const perfTrace = performance ? trace(performance, 'analyze_pantry_image') : null;
  perfTrace?.start();

  try {
    const modelId = "gemini-2.0-flash-lite";

    const schema: Schema = {
      type: Type.ARRAY,
      description: "A comprehensive list of pantry items identified in the image.",
      items: {
        type: Type.OBJECT,
        properties: {
          item: {
            type: Type.STRING,
            description: "The specific name of the item.",
          },
          category: {
            type: Type.STRING,
            description: "The broad category.",
          },
          quantity_estimate: {
            type: Type.STRING,
            description: "Visual estimate of quantity.",
          },
        },
        required: ["item", "category", "quantity_estimate"],
      },
    };

    const response = await ai.models.generateContent({
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
            text: `Analyze this image and provide a detailed inventory of the pantry items visible. Be precise with item names.

For categorization, use these standard categories when possible:
- Fruits & Vegetables (fresh produce, fruits, vegetables)
- Dairy & Eggs (milk, cheese, yogurt, eggs, butter)
- Meat & Poultry (beef, chicken, pork, turkey, bacon, sausage)
- Seafood (fish, shrimp, crab, canned tuna)
- Grains & Bread (rice, pasta, bread, cereals, flour, oats)
- Canned Goods (canned vegetables, soups, beans, tomatoes)
- Condiments & Sauces (ketchup, mustard, mayo, oils, vinegars, dressings)
- Snacks (chips, cookies, nuts, crackers, candy)
- Beverages (soda, juice, coffee, tea, water, alcohol)
- Frozen Foods (frozen vegetables, meals, ice cream, pizza)
- Baking Supplies (sugar, baking powder, vanilla, chocolate chips)
- Spices & Herbs (salt, pepper, garlic, herbs, spices)
- Breakfast Foods (cereal, oatmeal, pancake mix, syrup)

If an item doesn't fit these categories, use "Uncategorized".`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from Gemini.");

    const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    const items = JSON.parse(cleanJson) as PantryItem[];

    // Add custom metrics (if performance available)
    if (perfTrace) {
      perfTrace.putMetric('image_size_kb', base64Image.length / 1024);
      perfTrace.putMetric('items_detected', items.length);
    }

    // Track usage (local increment). Caller may provide user context in future.
    try { featureFlags.incrementGeminiUsage(undefined, 1); } catch (e) { /* ignore */ }

    return items;
  } catch (error) {
    console.error("Error analyzing pantry image:", error);
    throw error;
  } finally {
    perfTrace?.stop();
  }
};

/**
 * Searches for recipes using Google Search Grounding with enhanced filters and structured JSON output.
 */
export const searchRecipes = async (params: RecipeSearchParams): Promise<RecipeSearchResult> => {
    const perfTrace = performance ? trace(performance, 'search_recipes') : null;
  perfTrace?.start();

    try {
      // Gate Gemini usage for recipe search as well
      if (!featureFlags.isGeminiGloballyEnabled()) {
        throw new Error('Gemini integration is disabled by configuration.');
      }
      if (!featureFlags.canUseGemini(undefined)) {
        throw new Error('Gemini usage not permitted: opt-in required or daily cap reached.');
      }
    const modelId = "gemini-2.0-flash-lite";
  
  // Check if API key is available
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please check your environment variables.');
  }
  
  let prompt = "";

  if (params.query) {
    // Mode 1: Specific Search - ultra-concise for cost efficiency
    prompt = `2 recipes for "${params.query}"`;
    if (params.restrictions) prompt += `. Restrictions: ${params.restrictions}`;
  } else {
    // Mode 2: Generate from Pantry - ultra-concise
    const limitedIngredients = params.ingredients.split(', ').slice(0, 25).join(', ');
    prompt = `2 recipes using: ${limitedIngredients}`;
    
    if (params.strictMode) {
      prompt += `. Only these + basics (oil, salt, pepper, water)`;
    } else {
      prompt += `. Can add common items`;
    }

    if (params.restrictions) prompt += `. Restrictions: ${params.restrictions}`;
    if (params.maxCookTime) prompt += `. Max ${params.maxCookTime}min`;
    if (params.maxIngredients) prompt += `. Max ${params.maxIngredients} ingredients`;
  }

  prompt += `. Use ${params.measurementSystem} units`;

  // Ultra-concise JSON structure - be very explicit
  prompt += `. Respond ONLY with valid JSON in this exact format, no other text: {"recipes":[{"title":"string","description":"brief summary","ingredients":["concise ingredient with quantity"],"instructions":["3-5 key steps"],"cookTime":"string"}]}`;

  try {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout. Please try again.')), 35000); // 35 second timeout
    });

    const responsePromise = ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }]
      },
    });

    const response = await Promise.race([responsePromise, timeoutPromise]) as any;

        // console.debug('Gemini raw response:', response);

    const jsonText = response.text;
    let recipes: StructuredRecipe[] = [];
    
    if (jsonText) {
      // Clean up markdown if present
      const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
      
      try {
        // First try to parse as JSON
        const parsed = JSON.parse(cleanJson);
        recipes = parsed.recipes || [];
      } catch (jsonError) {
        console.warn("JSON Parse Error, attempting to extract JSON from text:", jsonError);
        // console.log("Raw Text:", jsonText);
        
        // Try to extract JSON from the text response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            recipes = extractedJson.recipes || [];
            // console.log("Successfully extracted JSON from text");
          } catch (extractError) {
            console.warn("Failed to extract JSON, falling back to text parsing:", extractError);
            
            // Last resort: try to parse natural language response
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
      perfTrace.putMetric('query_length', params.query?.length || 0);
      perfTrace.putMetric('ingredients_count', params.ingredients?.split(', ').length || 0);
      perfTrace.putMetric('recipes_returned', recipes.length);
      perfTrace.putAttribute('search_mode', params.query ? 'specific' : 'pantry_based');
      perfTrace.putAttribute('strict_mode', params.strictMode ? 'true' : 'false');
    }

    try { featureFlags.incrementGeminiUsage(undefined, 1); } catch (e) { /* ignore */ }

    return {
      recipes: recipes,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
    };
  } catch (timeoutError) {
    console.error("Request timeout or API error:", timeoutError);
    throw timeoutError;
  }

  } catch (error) {
    console.error("Error searching recipes:", error);
    
    // Provide more specific error messages
    if (error.message?.includes('API_KEY')) {
      throw new Error('API configuration error. Please check your Gemini API key.');
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      throw new Error('API quota exceeded. Please try again later.');
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error(`Recipe search failed: ${error.message || 'Unknown error'}`);
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
    
  } catch (error) {
    console.error("Error parsing natural language recipes:", error);
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