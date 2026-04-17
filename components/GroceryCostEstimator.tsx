import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Calculator, ShoppingCart, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { DayPlan, PantryItem } from '../types';
import { groceryPriceService, PriceData } from '../services/groceryPriceService';
import { parseIngredientForShoppingList } from '../utils/appUtils';
import { useAppActions } from '../contexts/AppActionsContext';
import { useApp } from '../contexts/AppContext';
import { log } from '../services/logService';
import AnalyticsService from '../services/analyticsService';

interface GroceryCostEstimatorProps {
  mealPlan: DayPlan[];
  inventory: PantryItem[];
  onEstimatorToggle?: (isOpen: boolean) => void;
  freeItemLimit?: number;
}

interface IngredientCost {
  ingredient: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  source: 'estimated' | 'known';
}

export const GroceryCostEstimator: React.FC<GroceryCostEstimatorProps> = ({ mealPlan, inventory, onEstimatorToggle, freeItemLimit }) => {
  const { addToast } = useAppActions();
  const { user } = useApp();
  const [showEstimator, setShowEstimator] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState<string | null>(null);
  const [userPriceInputs, setUserPriceInputs] = useState<Record<string, { price: string; unit: string; store: string }>>({});
  const [includeAllIngredients, setIncludeAllIngredients] = useState(false);

  const toggleEstimator = (isOpen: boolean) => {
    setShowEstimator(isOpen);
    onEstimatorToggle?.(isOpen);
    
    if (isOpen) {
      AnalyticsService.trackEvent('grocery_cost_estimator_opened', { mealPlanLength: mealPlan.length });
    }
  };

  // Fetch current prices when component mounts or meal plan changes
  useEffect(() => {
    if (showEstimator) {
      fetchCurrentPrices();
    }
  }, [showEstimator, mealPlan]);

  const fetchCurrentPrices = async () => {
    setLoadingPrices(true);
    try {
      // Get all unique ingredients from meal plan
      const allIngredients = mealPlan.flatMap(day =>
        [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || [])]
          .flatMap(meal => meal.recipe.ingredients || [])
      );

      const uniqueIngredients = [...new Set(allIngredients.map(ing => parseIngredient(ing).name))];

      const pricePromises = uniqueIngredients.map(async (ingredient) => {
        const data = await groceryPriceService.getIngredientPrice(ingredient as string);
        return { ingredient: (ingredient as string).toLowerCase(), data };
      });

      const results = await Promise.all(pricePromises);
      const newPriceData: Record<string, PriceData> = {};

      results.forEach(({ ingredient, data }) => {
        if (data) {
          newPriceData[ingredient] = data;
        }
      });

      setPriceData(newPriceData);
    } catch (error) {
      log.error('Error fetching prices', { error });
    } finally {
      setLoadingPrices(false);
    }
  };

  const submitUserPrice = async (ingredient: string) => {
    const input = userPriceInputs[ingredient];
    if (!input || !input.price || !input.unit) return;

    try {
      const price = parseFloat(input.price);
      if (isNaN(price) || price <= 0) return;

      // Use authenticated user's ID; userId is validated server-side by Firestore rules
      const userId = user?.id ?? '';

      await groceryPriceService.submitPriceUpdate(
        ingredient,
        price,
        input.unit,
        userId,
        input.store || undefined
      );

      // Clear the input
      setUserPriceInputs(prev => ({
        ...prev,
        [ingredient]: { price: '', unit: '', store: '' }
      }));

      setShowPriceInput(null);

      // Refresh prices
      await fetchCurrentPrices();

      addToast('Price submitted successfully! Thank you for contributing.', 'success');
      
      AnalyticsService.trackEvent('grocery_price_submitted', {
        ingredient,
        price: price.toString(),
        unit: input.unit,
        store: input.store || 'unknown'
      });
    } catch (error) {
      log.error('Error submitting price', { error });
      addToast('Error submitting price. Please try again.', 'error');
    }
  };

  // Common ingredient prices per unit (USD) - Updated 2024 prices
  const defaultPrices: Record<string, { price: number; unit: string }> = {
    // Proteins
    'chicken': { price: 3.99, unit: 'lb' },
    'beef': { price: 5.99, unit: 'lb' },
    'pork': { price: 4.49, unit: 'lb' },
    'fish': { price: 8.99, unit: 'lb' },
    'salmon': { price: 12.99, unit: 'lb' },
    'eggs': { price: 0.25, unit: 'each' },
    'milk': { price: 3.99, unit: 'gallon' },
    'cheese': { price: 4.99, unit: 'lb' },
    'yogurt': { price: 0.69, unit: 'cup' },
    'butter': { price: 4.99, unit: 'lb' },
    
    // Produce
    'onion': { price: 1.29, unit: 'lb' },
    'garlic': { price: 0.79, unit: 'head' },
    'tomato': { price: 2.49, unit: 'lb' },
    'lettuce': { price: 1.99, unit: 'head' },
    'carrot': { price: 1.49, unit: 'lb' },
    'potato': { price: 0.89, unit: 'lb' },
    'apple': { price: 2.49, unit: 'lb' },
    'banana': { price: 0.79, unit: 'lb' },
    'lemon': { price: 1.29, unit: 'each' },
    'lime': { price: 0.89, unit: 'each' },
    'broccoli': { price: 2.99, unit: 'head' },
    'spinach': { price: 3.99, unit: 'bag' },
    'bell pepper': { price: 1.99, unit: 'each' },
    'cucumber': { price: 1.49, unit: 'each' },
    
    // Pantry staples
    'flour': { price: 3.49, unit: 'lb' },
    'sugar': { price: 2.49, unit: 'lb' },
    'rice': { price: 2.99, unit: 'lb' },
    'pasta': { price: 1.49, unit: 'lb' },
    'bread': { price: 3.49, unit: 'loaf' },
    'oil': { price: 5.99, unit: 'bottle' },
    'salt': { price: 1.49, unit: 'container' },
    'pepper': { price: 2.99, unit: 'container' },
    
    // Spices & seasonings
    'cumin': { price: 4.99, unit: 'oz' },
    'paprika': { price: 3.99, unit: 'oz' },
    'oregano': { price: 3.49, unit: 'oz' },
    'thyme': { price: 3.99, unit: 'oz' },
    'basil': { price: 3.49, unit: 'oz' },
    'cinnamon': { price: 4.49, unit: 'oz' },
    'nutmeg': { price: 5.99, unit: 'oz' },
  };

  const getIngredientKey = (ingredient: string): string => {
    return ingredient.toLowerCase().split(' ')[0]; // Get first word
  };

  const parseIngredient = (ingredient: string): { name: string; quantity: number; unit: string } => {
    // Use the same parsing logic as parseIngredientForShoppingList but return structured data
    const parsed = parseIngredientForShoppingList(ingredient);
    
    // Extract quantity and unit from the parsed quantity string
    const quantityParts = parsed.quantity.split(' ');
    let quantity = 1;
    let unit = 'each';
    
    if (quantityParts.length >= 1) {
      // Handle fractions and decimals
      const qtyStr = quantityParts[0];
      if (qtyStr.includes('/')) {
        // Handle fractions like "1/2"
        const [numerator, denominator] = qtyStr.split('/').map(Number);
        quantity = numerator / denominator;
      } else {
        quantity = parseFloat(qtyStr) || 1;
      }
      
      // Check for unit in remaining parts
      if (quantityParts.length > 1) {
        unit = quantityParts.slice(1).join(' ').toLowerCase();
      } else {
        // Try to infer unit from the quantity string
        const qtyMatch = parsed.quantity.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(.+)$/);
        if (qtyMatch) {
          const qtyStr = qtyMatch[1];
          if (qtyStr.includes('/')) {
            // Handle fractions like "1/2" or "1 1/2"
            const parts = qtyStr.split(' ');
            let total = 0;
            for (const part of parts) {
              if (part.includes('/')) {
                const [num, den] = part.split('/').map(Number);
                total += num / den;
              } else {
                total += parseFloat(part) || 0;
              }
            }
            quantity = total;
          } else {
            quantity = parseFloat(qtyStr) || 1;
          }
          unit = qtyMatch[2] || 'each';
        }
      }
    }
    
    // Clean up the item name
    let name = parsed.itemName.toLowerCase()
      .replace(/\b(large|medium|small|big|tiny|huge|giant)\s+/gi, '')
      .replace(/\b(ripe|raw|cooked|baked|fried|organic|chopped|minced|diced|sliced|grated)\s+/gi, '')
      .trim();
    
    // Capitalize first letter
    name = name.replace(/\b\w/g, l => l.toUpperCase());
    
    return { name, quantity, unit };
  };

  const estimateCost = (ingredient: string): IngredientCost => {
    const parsed = parseIngredient(ingredient);
    const key = getIngredientKey(parsed.name);
    const normalizedKey = key.toLowerCase();

    // Priority 1: Check if user has set a custom price
    if (customPrices[key]) {
      return {
        ingredient: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        estimatedCost: customPrices[key] * parsed.quantity,
        source: 'known'
      };
    }

    // Priority 2: Check real-time price data from API/user submissions
    const realTimeData = priceData[normalizedKey];
    if (realTimeData) {
      return {
        ingredient: parsed.name,
        quantity: parsed.quantity,
        unit: realTimeData.unit,
        estimatedCost: realTimeData.minPrice * parsed.quantity,
        source: 'known'
      };
    }

    // Priority 3: Check default prices (curated list)
    if (defaultPrices[key]) {
      const priceInfo = defaultPrices[key];
      return {
        ingredient: parsed.name,
        quantity: parsed.quantity,
        unit: priceInfo.unit,
        estimatedCost: priceInfo.price * parsed.quantity,
        source: 'estimated'
      };
    }

    // Priority 4: Try to match partial ingredient names
    const partialMatch = Object.keys(defaultPrices).find(
      k => normalizedKey.includes(k) || k.includes(normalizedKey)
    );
    if (partialMatch) {
      const priceInfo = defaultPrices[partialMatch];
      return {
        ingredient: parsed.name,
        quantity: parsed.quantity,
        unit: priceInfo.unit,
        estimatedCost: priceInfo.price * parsed.quantity,
        source: 'estimated'
      };
    }

    // Final fallback: Generic estimate based on common ingredient types
    let estimatePrice = 2.00;
    if (normalizedKey.includes('meat') || normalizedKey.includes('chicken') || normalizedKey.includes('beef')) {
      estimatePrice = 5.00;
    } else if (normalizedKey.includes('fish') || normalizedKey.includes('salmon')) {
      estimatePrice = 9.00;
    } else if (normalizedKey.includes('dairy') || normalizedKey.includes('milk') || normalizedKey.includes('cheese')) {
      estimatePrice = 4.00;
    } else if (normalizedKey.includes('vegetable') || normalizedKey.includes('fruit')) {
      estimatePrice = 2.00;
    }

    return {
      ingredient: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      estimatedCost: estimatePrice * parsed.quantity,
      source: 'estimated'
    };
  };

  const costBreakdown = useMemo(() => {
    const allIngredients = mealPlan.flatMap(day => 
      [...(day.breakfast || []), ...(day.lunch || []), ...(day.dinner || [])].flatMap(meal => meal.recipe.ingredients || [])
    );
    
    // Group by ingredient name
    const groupedIngredients: Record<string, number> = {};
    
    allIngredients.forEach(ing => {
      const parsed = parseIngredient(ing);
      const key = parsed.name.toLowerCase();
      groupedIngredients[key] = (groupedIngredients[key] || 0) + parsed.quantity;
    });
    
    // Check inventory and calculate costs for missing items (or all items if includeAllIngredients is true)
    const costItems: IngredientCost[] = [];
    
    Object.entries(groupedIngredients).forEach(([name, totalQty]) => {
      // Check if we have this in inventory
      const inInventory = inventory.some(item => 
        name.includes(item.item.toLowerCase()) || 
        item.item.toLowerCase().includes(name)
      );
      
      if (includeAllIngredients || !inInventory) {
        const costItem = estimateCost(`${totalQty} ${name}`);
        costItem.quantity = totalQty;
        costItems.push(costItem);
      }
    });
    
    return costItems;
  }, [mealPlan, inventory, customPrices, includeAllIngredients]);

  const visibleBreakdown = freeItemLimit !== undefined ? costBreakdown.slice(0, freeItemLimit) : costBreakdown;
  const lockedCount = freeItemLimit !== undefined ? Math.max(0, costBreakdown.length - freeItemLimit) : 0;
  const totalCost = visibleBreakdown.reduce((sum, item) => sum + item.estimatedCost, 0);

  if (!showEstimator) {
    return (
      <button
        onClick={() => toggleEstimator(true)}
        className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors whitespace-nowrap"
      >
        <Calculator className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">Estimate Grocery Costs</span>
      </button>
    );
  }

  return (
    <div className="bg-theme-primary rounded-xl p-6 border border-theme">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-secondary flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Grocery Cost Estimator
        </h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              checked={includeAllIngredients}
              onChange={(e) => setIncludeAllIngredients(e.target.checked)}
              className="rounded"
            />
            Include all ingredients
          </label>
          <button
            onClick={() => toggleEstimator(false)}
            className="text-theme-secondary hover:text-theme-primary"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-theme-secondary/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            ${totalCost.toFixed(2)}
          </div>
          <div className="text-sm text-theme-secondary">
            Estimated cost for {includeAllIngredients ? 'all' : 'missing'} ingredients
            {lockedCount > 0 && <span className="ml-1 text-amber-600">(first {freeItemLimit} shown — upgrade for full estimate)</span>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-theme-secondary">{includeAllIngredients ? 'All' : 'Missing'} Ingredients:</h4>
            <button
              onClick={fetchCurrentPrices}
              disabled={loadingPrices}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPrices ? 'animate-spin' : ''}`} />
              Refresh Prices
            </button>
          </div>
          {costBreakdown.length === 0 ? (
            <p className="text-sm text-theme-secondary/70">All ingredients are in your pantry! 🎉</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {visibleBreakdown.map((item, index) => {
                const ingredientKey = getIngredientKey(item.ingredient).toLowerCase();
                const realTimeData = priceData[ingredientKey];
                const hasRealTimeData = !!realTimeData;

                return (
                  <div key={index} className="py-2 px-3 bg-theme-secondary/5 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <span className="font-medium">{item.ingredient}</span>
                        <span className="text-sm text-theme-secondary/70 ml-2">
                          ({item.quantity} {item.unit})
                        </span>
                        {hasRealTimeData && (
                          <span className="text-xs text-green-600 ml-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Live data ({realTimeData.sampleSize} samples)
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-lg">${item.estimatedCost.toFixed(2)}</span>
                        {hasRealTimeData && (
                          <div className="text-xs text-theme-secondary/70">
                            ${realTimeData.minPrice.toFixed(2)} - ${realTimeData.maxPrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Custom price"
                        className="flex-1 px-2 py-1 text-sm border border-theme rounded text-black"
                        onChange={(e) => {
                          const price = parseFloat(e.target.value);
                          if (!isNaN(price)) {
                            setCustomPrices(prev => ({
                              ...prev,
                              [getIngredientKey(item.ingredient)]: price
                            }));
                          }
                        }}
                      />
                      <button
                        onClick={() => setShowPriceInput(showPriceInput === item.ingredient ? null : item.ingredient)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" />
                        Contribute Price
                      </button>
                    </div>

                    {showPriceInput === item.ingredient && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Price"
                            className="px-2 py-1 text-sm border rounded text-black"
                            value={userPriceInputs[item.ingredient]?.price || ''}
                            onChange={(e) => setUserPriceInputs(prev => ({
                              ...prev,
                              [item.ingredient]: { ...prev[item.ingredient], price: e.target.value }
                            }))}
                          />
                          <input
                            type="text"
                            placeholder="Unit (lb, each, etc.)"
                            className="px-2 py-1 text-sm border rounded text-black"
                            value={userPriceInputs[item.ingredient]?.unit || ''}
                            onChange={(e) => setUserPriceInputs(prev => ({
                              ...prev,
                              [item.ingredient]: { ...prev[item.ingredient], unit: e.target.value }
                            }))}
                          />
                          <input
                            type="text"
                            placeholder="Store (optional)"
                            className="px-2 py-1 text-sm border rounded text-black"
                            value={userPriceInputs[item.ingredient]?.store || ''}
                            onChange={(e) => setUserPriceInputs(prev => ({
                              ...prev,
                              [item.ingredient]: { ...prev[item.ingredient], store: e.target.value }
                            }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitUserPrice(item.ingredient)}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Submit Price
                          </button>
                          <button
                            onClick={() => setShowPriceInput(null)}
                            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {lockedCount > 0 && (
                <div className="py-3 px-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 text-sm font-medium">🔒 +{lockedCount} more ingredient{lockedCount !== 1 ? 's' : ''} hidden</span>
                  </div>
                  <span className="text-xs text-amber-600">Upgrade to see all</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-theme-secondary/70 bg-theme-secondary/5 p-3 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 mt-0.5 text-green-600" />
            <div>
              <strong>Live Price Data:</strong> Prices are updated from community contributions and show current market rates.
              Green indicators show live data availability.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 mt-0.5 text-blue-600" />
            <div>
              <strong>Contribute Prices:</strong> Help improve estimates by sharing current prices from your local stores.
            </div>
          </div>
          <div>
            💡 <strong>Pro tip:</strong> Costs only include ingredients not already in your pantry. Use custom prices for the most accurate estimates.
          </div>
        </div>
      </div>
    </div>
  );
};