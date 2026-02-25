import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb, TrendingUp, Package, Clock, Plus } from 'lucide-react';

interface ShoppingSuggestion {
  id: string;
  type: 'restock' | 'frequent' | 'seasonal' | 'complementary';
  itemName: string;
  reason: string;
  confidence: number; // 0-1
  estimatedQuantity?: string;
  category?: string;
  lastPurchased?: Date;
  frequency?: string; // 'weekly', 'monthly', etc.
}

interface SmartShoppingSuggestionsProps {
  pantryItems: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    lastUpdated: Date;
    expirationDate?: Date;
  }>;
  recentPurchases: Array<{
    itemName: string;
    quantity: number;
    unit: string;
    category?: string;
    purchasedAt: Date;
  }>;
  onAddSuggestion: (suggestion: ShoppingSuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
}

export const SmartShoppingSuggestions: React.FC<SmartShoppingSuggestionsProps> = ({
  pantryItems,
  recentPurchases,
  onAddSuggestion,
  onDismissSuggestion
}) => {
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const suggestions = useMemo(() => {
    const now = new Date();
    const suggestions: ShoppingSuggestion[] = [];

    // Restock suggestions based on low inventory
    pantryItems.forEach(item => {
      if (item.quantity <= 1) { // Low stock threshold
        const recentPurchase = recentPurchases
          .filter(p => p.itemName.toLowerCase() === item.name.toLowerCase())
          .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime())[0];

        suggestions.push({
          id: `restock-${item.id}`,
          type: 'restock',
          itemName: item.name,
          reason: `Low stock (${item.quantity} ${item.unit} remaining)`,
          confidence: 0.9,
          estimatedQuantity: recentPurchase ? `${recentPurchase.quantity} ${recentPurchase.unit}` : undefined,
          category: item.category,
          lastPurchased: recentPurchase?.purchasedAt
        });
      }
    });

    // Frequent purchase suggestions
    const purchaseFrequency = new Map<string, { count: number; lastPurchase: Date; avgInterval: number }>();

    recentPurchases.forEach(purchase => {
      const key = purchase.itemName.toLowerCase();
      const existing = purchaseFrequency.get(key);

      if (existing) {
        existing.count++;
        const interval = purchase.purchasedAt.getTime() - existing.lastPurchase.getTime();
        existing.avgInterval = (existing.avgInterval * (existing.count - 1) + interval) / existing.count;
        existing.lastPurchase = purchase.purchasedAt;
      } else {
        purchaseFrequency.set(key, {
          count: 1,
          lastPurchase: purchase.purchasedAt,
          avgInterval: 0
        });
      }
    });

    purchaseFrequency.forEach((freq, itemName) => {
      if (freq.count >= 3) { // Purchased at least 3 times
        const daysSinceLastPurchase = (now.getTime() - freq.lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
        const expectedInterval = freq.avgInterval / (1000 * 60 * 60 * 24); // Convert to days

        let frequency = 'monthly';
        if (expectedInterval <= 7) frequency = 'weekly';
        else if (expectedInterval <= 14) frequency = 'bi-weekly';

        if (daysSinceLastPurchase > expectedInterval * 1.2) { // 20% past expected interval
          const confidence = Math.max(0.3, Math.min(0.8, freq.count / 10)); // Higher confidence for more purchases

          suggestions.push({
            id: `frequent-${itemName}`,
            type: 'frequent',
            itemName: itemName,
            reason: `Usually purchased ${frequency}`,
            confidence,
            frequency,
            lastPurchased: freq.lastPurchase
          });
        }
      }
    });

    // Seasonal suggestions (basic implementation)
    const currentMonth = now.getMonth();
    const seasonalItems = {
      11: ['cranberries', 'pumpkin', 'sweet potatoes', 'brussels sprouts'], // December
      0: ['oranges', 'pomegranates', 'kale', 'blood oranges'], // January
      1: ['avocados', 'citrus', 'broccoli'], // February
      2: ['asparagus', 'strawberries', 'peas'], // March
      3: ['spinach', 'lettuce', 'radishes'], // April
      4: ['berries', 'cherries', 'peas'], // May
      5: ['corn', 'tomatoes', 'zucchini'], // June
      6: ['peaches', 'plums', 'eggplant'], // July
      7: ['apples', 'pears', 'grapes'], // August
      8: ['squash', 'pumpkins', 'apples'], // September
      9: ['persimmons', 'pomegranates', 'kale'], // October
      10: ['cranberries', 'sweet potatoes', 'squash'] // November
    };

    const currentSeasonalItems = (seasonalItems as any)[currentMonth] || [];
    currentSeasonalItems.forEach((item: string) => {
      const hasInPantry = pantryItems.some(p => p.name.toLowerCase().includes(item.toLowerCase()));
      if (!hasInPantry) {
        suggestions.push({
          id: `seasonal-${item}`,
          type: 'seasonal',
          itemName: item,
          reason: 'In season now',
          confidence: 0.6,
          category: 'produce'
        });
      }
    });

    // Complementary suggestions (basic pairing logic)
    const complementaryPairs = [
      ['bread', 'butter'],
      ['pasta', 'tomato sauce'],
      ['rice', 'soy sauce'],
      ['chicken', 'rice'],
      ['beef', 'potatoes'],
      ['fish', 'lemon'],
      ['coffee', 'cream'],
      ['tea', 'honey']
    ];

    pantryItems.forEach(item => {
      complementaryPairs.forEach(([item1, item2]) => {
        if (item.name.toLowerCase().includes(item1.toLowerCase())) {
          const hasComplementary = pantryItems.some(p =>
            p.name.toLowerCase().includes(item2.toLowerCase())
          );
          if (!hasComplementary) {
            suggestions.push({
              id: `complementary-${item.id}-${item2}`,
              type: 'complementary',
              itemName: item2,
              reason: `Complements your ${item.name}`,
              confidence: 0.4
            });
          }
        }
      });
    });

    // Sort by confidence and filter dismissed
    return suggestions
      .filter(s => !dismissedSuggestions.has(s.id))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10

  }, [pantryItems, recentPurchases, dismissedSuggestions]);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'restock': return <Package className="w-4 h-4 text-orange-500" />;
      case 'frequent': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'seasonal': return <Clock className="w-4 h-4 text-green-500" />;
      case 'complementary': return <Lightbulb className="w-4 h-4 text-purple-500" />;
      default: return <Lightbulb className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const handleAddSuggestion = (suggestion: ShoppingSuggestion) => {
    onAddSuggestion(suggestion);
    setDismissedSuggestions(prev => new Set([...prev, suggestion.id]));
  };

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]));
    onDismissSuggestion(suggestionId);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Smart Suggestions ({suggestions.length})
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--accent-color)] hover:underline"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className={`space-y-2 ${expanded ? '' : 'max-h-32 overflow-hidden'}`}>
        {suggestions.map(suggestion => (
          <div key={suggestion.id} className="flex items-center justify-between p-2 bg-theme-primary rounded-lg border border-theme/50">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {getSuggestionIcon(suggestion.type)}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-theme-primary text-sm truncate">
                  {suggestion.itemName}
                </div>
                <div className="text-xs text-theme-secondary">
                  {suggestion.reason}
                  {suggestion.estimatedQuantity && (
                    <span className="ml-1 text-[var(--accent-color)]">
                      • Suggest: {suggestion.estimatedQuantity}
                    </span>
                  )}
                </div>
              </div>
              <div className={`text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                {Math.round(suggestion.confidence * 100)}%
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleAddSuggestion(suggestion)}
                className="p-1.5 bg-[var(--accent-color)] text-white rounded-md hover:bg-[var(--accent-color)]/90 transition-colors"
                title="Add to shopping list"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="p-1.5 text-theme-secondary hover:text-theme-primary transition-colors"
                title="Dismiss suggestion"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {!expanded && suggestions.length > 3 && (
        <div className="text-xs text-theme-secondary opacity-60 mt-2 text-center">
          +{suggestions.length - 3} more suggestions...
        </div>
      )}
    </div>
  );
};

export default SmartShoppingSuggestions;