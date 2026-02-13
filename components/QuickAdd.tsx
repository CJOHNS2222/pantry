import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Lightbulb, TrendingUp, Package, Clock, Archive, Undo2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getItemImage, inferCategoryFromItemName } from '../utils/appUtils';
import { QuickAddModal } from './QuickAddModal';

interface QuickAddItem {
  name: string;
  category?: string;
  quantity?: string;
  unit?: string;
}

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

interface QuickAddProps {
  onAddItem: (item: QuickAddItem) => void;
  onScanBarcode?: () => Promise<QuickAddItem | null>;
  onVoiceInput?: () => Promise<string | null>;
  isOnline: boolean;
  recentItems?: string[];
  suggestedItems?: string[];
  onAddSuggestedItem?: (itemName: string) => void;
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

export const QuickAdd: React.FC<QuickAddProps> = ({
  onAddItem,
  onScanBarcode,
  onVoiceInput,
  isOnline,
  recentItems = [],
  suggestedItems = [],
  onAddSuggestedItem,
  pantryItems,
  recentPurchases,
  onAddSuggestion,
  onDismissSuggestion
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
          suggestions.push({
            id: `frequent-${itemName}`,
            type: 'frequent',
            itemName,
            reason: `Usually purchased ${frequency}`,
            confidence: Math.max(0.3, Math.min(0.8, freq.count / 10)), // Higher confidence for more purchases
            frequency
          });
        }
      }
    });

    // Seasonal suggestions (simplified)
    const currentMonth = now.getMonth();
    if (currentMonth >= 9 || currentMonth <= 2) { // Fall/Winter
      suggestions.push({
        id: 'seasonal-soup',
        type: 'seasonal',
        itemName: 'Soup',
        reason: 'Popular in cooler weather',
        confidence: 0.5
      });
    }

    // Complementary item suggestions
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

  // Initialize scroll state
  useEffect(() => {
    const checkScrollState = () => {
      const container = document.querySelector('.quick-add-scroll') as HTMLElement;
      if (container) {
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    // Check after a short delay to ensure DOM is ready
    const timer = setTimeout(checkScrollState, 100);
    return () => clearTimeout(timer);
  }, [suggestedItems]);

  const handleAddSuggestedItem = (itemName: string) => {
    if (onAddSuggestedItem) {
      onAddSuggestedItem(itemName);
    } else {
      // Fallback: parse and add the item directly
      const quantityMatch = itemName.match(/^(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)$/);
      let parsedItem: QuickAddItem;

      if (quantityMatch) {
        const [, quantity, unit, name] = quantityMatch;
        parsedItem = {
          name: name.trim(),
          quantity,
          unit
        };
      } else {
        parsedItem = {
          name: itemName
        };
      }

      onAddItem(parsedItem);
    }
  };

  const handleAddSuggestion = (suggestion: ShoppingSuggestion) => {
    onAddSuggestion(suggestion);
    setDismissedSuggestions(prev => new Set([...prev, suggestion.id]));
  };

  const handleDismiss = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]));
    onDismissSuggestion(suggestionId);
  };

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollLeft = target.scrollLeft;
    const scrollWidth = target.scrollWidth;
    const clientWidth = target.clientWidth;
    
    setScrollPosition(scrollLeft);
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollLeft = () => {
    const container = document.querySelector('.quick-add-scroll') as HTMLElement;
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.querySelector('.quick-add-scroll') as HTMLElement;
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // Calculate scroll progress for the progress bar
  const getScrollProgress = () => {
    const container = document.querySelector('.quick-add-scroll') as HTMLElement;
    if (!container) return 0;
    
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    if (scrollWidth <= clientWidth) return 100;
    return (scrollLeft / (scrollWidth - clientWidth)) * 100;
  };

  return (
    <div>
      <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--accent-color)]" />
            <span className="text-sm font-semibold text-theme-primary">Add Items</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors"
            aria-label="Add new item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Combined Suggestions */}
        {(suggestedItems.length > 0 || suggestions.length > 0) && (
          <div className="mt-4">
            {/* Quick Add Suggestions - Always visible */}
            {suggestedItems.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Quick Add Suggestions
                </h4>
                <div className="relative">
                  {/* Left fade and arrow */}
                  {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
                      <div className="w-8 h-full bg-gradient-to-r from-theme-secondary to-transparent pointer-events-none" />
                      <button
                        onClick={scrollLeft}
                        className="absolute left-1 p-1 bg-theme-primary/80 hover:bg-theme-primary rounded-full shadow-md transition-colors"
                        aria-label="Scroll left"
                      >
                        <ChevronLeft className="w-4 h-4 text-theme-primary" />
                      </button>
                    </div>
                  )}

                  {/* Right fade and arrow */}
                  {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end">
                      <div className="w-8 h-full bg-gradient-to-l from-theme-secondary to-transparent pointer-events-none" />
                      <button
                        onClick={scrollRight}
                        className="absolute right-1 p-1 bg-theme-primary/80 hover:bg-theme-primary rounded-full shadow-md transition-colors"
                        aria-label="Scroll right"
                      >
                        <ChevronRight className="w-4 h-4 text-theme-primary" />
                      </button>
                    </div>
                  )}

                  {/* Scrollable container */}
                  <div
                    className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-nowrap quick-add-scroll"
                    onScroll={handleScroll}
                  >
                    {suggestedItems.map((itemName) => (
                      <button
                        key={itemName}
                        onClick={() => handleAddSuggestedItem(itemName)}
                        className="flex-shrink-0 flex flex-col items-center gap-2 p-3 bg-theme-primary rounded-lg border border-theme hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all group min-w-[80px]"
                      >
                        <img
                          src={getItemImage(itemName, inferCategoryFromItemName(itemName))}
                          alt={itemName}
                          className="w-10 h-10 rounded-lg object-cover bg-theme-secondary border border-theme"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/images/placeholder.svg';
                          }}
                        />
                        <span className="text-xs font-medium text-theme-primary text-center leading-tight group-hover:text-[var(--accent-color)] transition-colors">
                          {itemName}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Scroll progress bar */}
                  <div className="mt-2 h-1 bg-theme-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-color)] transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${getScrollProgress()}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Smart Suggestions - Expandable */}
            {suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Smart Suggestions ({suggestions.length})
                </h4>
                <div className={`space-y-2 ${expanded ? '' : 'max-h-60 overflow-hidden'}`}>
                  {suggestions.map(suggestion => (
                    <div key={suggestion.id} className="flex items-center justify-between p-2 bg-theme-primary rounded-lg border border-theme/50 mb-2">
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

                {suggestions.length > 8 && (
                  <div className="text-center mt-3">
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="text-xs text-[var(--accent-color)] hover:underline"
                    >
                      {expanded ? 'Show Less' : `Show ${suggestions.length - 8} More`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <QuickAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddItem={onAddItem}
        onScanBarcode={onScanBarcode}
        onVoiceInput={onVoiceInput}
        isOnline={isOnline}
        recentItems={recentItems}
      />
    </div>
  );
};

export default QuickAdd;