import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PantryItem, RecipeSearchResult } from "../types";

// Initialize Gemini Client
// CRITICAL: We use process.env.API_KEY directly as requested.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes an image to identify pantry items.
 * Uses Gemini 2.5 Flash for multimodal analysis with JSON schema.
 */
export const analyzePantryImage = async (base64Image: string, mimeType: string): Promise<PantryItem[]> => {
  // Flash is optimized for speed and multimodal tasks like this
  const modelId = "gemini-2.5-flash"; 

  const schema: Schema = {
    type: Type.ARRAY,
    description: "A comprehensive list of pantry items identified in the image.",
    items: {
      type: Type.OBJECT,
      properties: {
        item: {
          type: Type.STRING,
          description: "The specific name of the item (e.g., 'Canned Tomatoes', 'Quinoa', 'Olive Oil').",
        },
        category: {
          type: Type.STRING,
          description: "The broad category (e.g., 'Canned Goods', 'Grains', 'Condiments', 'Produce').",
        },
        quantity_estimate: {
          type: Type.STRING,
          description: "Visual estimate of quantity (e.g., '1 full jar', 'approx 500g', '2 boxes').",
        },
      },
      required: ["item", "category", "quantity_estimate"],
    },
  };

  try {
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
            text: "Analyze this image and provide a detailed inventory of the pantry items visible. Be precise with item names.",
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
    
    // Clean potential markdown fences just in case
    const cleanJson = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    return JSON.parse(cleanJson) as PantryItem[];

  } catch (error) {
    console.error("Error analyzing pantry image:", error);
    throw error;
  }
};

/**
 * Searches for recipes using Google Search Grounding.
 * Uses Gemini 2.5 Flash with googleSearch tool.
 * Note: JSON mode is NOT compatible with googleSearch tool, so we request structured text.
 */
export const searchRecipes = async (ingredients: string, restrictions: string): Promise<RecipeSearchResult> => {
  const modelId = "gemini-2.5-flash";

  let prompt = `I have these ingredients: ${ingredients}. `;
  
  if (restrictions) {
    prompt += `Please respect these dietary restrictions: ${restrictions}. `;
  }

  prompt += `
Please find 3 creative and distinct recipes I can make. 
For each recipe, provide:
1. The Recipe Title (in bold)
2. A brief appetizing description
3. A list of key ingredients required

Format the response in Markdown for easy reading.
`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable Google Search Grounding
      },
    });

    return {
      text: response.text || "I couldn't find any recipes at this time.",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
    };

  } catch (error) {
    console.error("Error searching recipes:", error);
    throw error;
  }
};
