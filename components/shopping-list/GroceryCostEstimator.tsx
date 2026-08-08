import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Calculator, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { ShoppingItem } from '../../types';
import { Tab } from '../../types/app';
import { groceryPriceService, PriceData } from '../../services/groceryPriceService';
import { formatCurrency } from '../../services/currencyService';
import { parseIngredientForShoppingList, consolidateShoppingList } from '../../utils/appUtils';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useApp } from '../../contexts/AppContext';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { PaywallPrompt } from '../ui/PaywallPrompt';

export interface MissingIngredient {
  ingredient: string;
  structuredName?: string;
  recipeName: string;
  recipeId?: string;
}

interface GroceryCostEstimatorProps {
  missingIngredients: MissingIngredient[];
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

// Mirrors ShoppingList.tsx's estimateItemPrice: price is the item's average
// per-unit price times the raw parsed quantity (no unit conversion). Default
// prices in groceryPriceService are quoted per whatever unit is customary for
// that item (e.g. per lb, per dozen, per bottle) and recipe quantities are
// treated as that many of that unit — same assumption the shopping list's
// own cost tracking already makes, so totals here agree with it.
function parseQuantity(quantity?: number | string): number {
  if (typeof quantity === 'number') return quantity;
  if (typeof quantity === 'string') {
    const parsed = parseFloat(quantity);
    if (!isNaN(parsed)) return parsed;
  }
  return 1;
}

export const GroceryCostEstimator: React.FC<GroceryCostEstimatorProps> = ({ missingIngredients, onEstimatorToggle, freeItemLimit }) => {
  const { addToast, setActiveTab, setActiveSettingsCategory } = useAppActions();
  const { user } = useApp();
  const [showEstimator, setShowEstimator] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [priceData, setPriceData] = useState<Record<string, PriceData>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState<string | null>(null);
  const [userPriceInputs, setUserPriceInputs] = useState<Record<string, { price: string; unit: string; store: string }>>({});

  const toggleEstimator = (isOpen: boolean) => {
    setShowEstimator(isOpen);
    onEstimatorToggle?.(isOpen);

    if (isOpen) {
      AnalyticsService.trackEvent('grocery_cost_estimator_opened', { mealPlanLength: missingIngredients.length });
    }
  };

  // Consolidate missing ingredients the same way the shopping list consolidates
  // its own items, so duplicate ingredients across recipes are merged instead
  // of priced (and counted) once per recipe occurrence.
  const consolidated = useMemo(() => {
    const tempShoppingItems: ShoppingItem[] = missingIngredients.map((entry, idx) => {
      const parsed = parseIngredientForShoppingList(entry.ingredient);
      const name = entry.structuredName || parsed.itemName;
      return {
        id: `temp-${idx}`,
        item: name,
        quantity: parsed.quantity,
        category: '',
        checked: false
      };
    });

    return consolidateShoppingList(tempShoppingItems);
  }, [missingIngredients]);

  const getIngredientKey = (name: string): string => name.toLowerCase().trim();

  // Fetch current prices when the estimator opens or the ingredient set changes
  useEffect(() => {
    if (showEstimator) {
      fetchCurrentPrices();
    }
  }, [showEstimator, consolidated]);

  const fetchCurrentPrices = async () => {
    setLoadingPrices(true);
    try {
      const pricePromises = consolidated.map(async (item) => {
        const data = await groceryPriceService.getIngredientPrice(item.item);
        return { key: getIngredientKey(item.item), data };
      });

      const results = await Promise.all(pricePromises);
      const newPriceData: Record<string, PriceData> = {};

      results.forEach(({ key, data }) => {
        if (data) {
          newPriceData[key] = data;
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

  const costBreakdown = useMemo(() => {
    return consolidated.map((item): IngredientCost => {
      const key = getIngredientKey(item.item);
      const qty = parseQuantity(item.amount ?? item.quantity);

      // Priority 1: user-set custom price
      if (customPrices[key]) {
        return {
          ingredient: item.item,
          quantity: qty,
          unit: item.unit || 'each',
          estimatedCost: customPrices[key] * qty,
          source: 'known'
        };
      }

      // Priority 2: live price data (API/user submissions) — same formula the
      // shopping list uses: averagePrice * raw quantity, no unit conversion.
      const realTimeData = priceData[key];
      if (realTimeData) {
        return {
          ingredient: item.item,
          quantity: qty,
          unit: item.unit || realTimeData.unit,
          estimatedCost: realTimeData.averagePrice * qty,
          source: 'known'
        };
      }

      // Priority 3: curated default price database
      const priceInfo = groceryPriceService.getDefaultPrice(item.item);
      return {
        ingredient: item.item,
        quantity: qty,
        unit: item.unit || priceInfo.unit,
        estimatedCost: priceInfo.price * qty,
        source: 'estimated'
      };
    });
  }, [consolidated, customPrices, priceData]);

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
        <button
          onClick={() => toggleEstimator(false)}
          className="text-theme-secondary hover:text-theme-primary"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-theme-secondary/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalCost)}
          </div>
          <div className="text-sm text-theme-secondary">
            Estimated cost for ingredients not already in your pantry or on your shopping list
            {lockedCount > 0 && (
              <PaywallPrompt
                variant="inline"
                feature="grocery cost estimates"
                message={`first ${freeItemLimit} shown — upgrade for full estimate`}
                onUpgrade={() => { setActiveSettingsCategory('subscription'); setActiveTab(Tab.SETTINGS); }}
                className="ml-1 text-amber-600 hover:text-amber-700 underline text-xs"
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-theme-secondary">Missing Ingredients:</h4>
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
            <p className="text-sm text-theme-secondary/70">All ingredients are in your pantry or already on your shopping list! 🎉</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {visibleBreakdown.map((item, index) => {
                const key = getIngredientKey(item.ingredient);
                const realTimeData = priceData[key];
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
                        <span className="font-medium text-lg">{formatCurrency(item.estimatedCost)}</span>
                        {hasRealTimeData && (
                          <div className="text-xs text-theme-secondary/70">
                            {formatCurrency(realTimeData.minPrice)} - {formatCurrency(realTimeData.maxPrice)}
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
            💡 <strong>Pro tip:</strong> Costs only include ingredients not already in your pantry or on your shopping list. Use custom prices for the most accurate estimates.
          </div>
        </div>
      </div>
    </div>
  );
};
