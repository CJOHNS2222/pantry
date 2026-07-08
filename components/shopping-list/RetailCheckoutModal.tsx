import React, { useState, useMemo } from 'react';
import { X, Check, Search, ShoppingBag, ArrowUpRight, Link2, Save } from 'lucide-react';
import { ShoppingItem } from '../../types';
import { Browser } from '@capacitor/browser';
import {
  generateWalmartCartUrl,
  generateSearchUrl,
  hasWalmartMatch,
  wrapWithImpactTracker
} from '../../services/groceryCheckoutService';

interface RetailCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  onUpdateItem?: (updatedItem: ShoppingItem) => void;
}

export const RetailCheckoutModal: React.FC<RetailCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateItem,
}) => {
  const [selectedRetailer, setSelectedRetailer] = useState<'walmart' | 'target' | 'kroger' | 'instacart' | 'albertsons' | 'thrive'>('walmart');
  
  // Track which item has the linker input open
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkInputValue, setLinkInputValue] = useState<string>('');
  
  // Filter only unchecked items for checkout
  const checkoutableItems = items.filter(item => !item.checked);

  // Sort items: unmatched (search) items first, matched (direct cart) items last
  const sortedCheckoutableItems = useMemo(() => {
    return [...checkoutableItems].sort((a, b) => {
      const aMatched = hasWalmartMatch(a);
      const bMatched = hasWalmartMatch(b);
      if (!aMatched && bMatched) return -1;
      if (aMatched && !bMatched) return 1;
      return 0;
    });
  }, [checkoutableItems]);
  
  // Track which items the user has checked for inclusion
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    checkoutableItems.forEach(item => {
      // Direct-cart items are checked by default, search items are deselected by default
      initial[item.id] = hasWalmartMatch(item);
    });
    return initial;
  });

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    // If clicking the row while editing the link, do not toggle selection
    if (linkingItemId === id) return;
    setSelectedItemIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStartLink = (e: React.MouseEvent, item: ShoppingItem) => {
    e.stopPropagation(); // Prevent row click toggle
    setLinkingItemId(item.id);
    setLinkInputValue(item.walmartItemId || '');
  };

  const handleSaveLink = (e: React.MouseEvent, item: ShoppingItem) => {
    e.stopPropagation(); // Prevent row click toggle
    if (!onUpdateItem) return;

    let parsedId = linkInputValue.trim();
    
    // Parse ID from URL if user pasted a full link
    // e.g. https://www.walmart.com/ip/Great-Value-Organic-Bananas-1-Bunch/44390948
    if (parsedId.includes('walmart.com') || parsedId.includes('http')) {
      const ipMatch = parsedId.match(/\/ip\/(?:[^\/]+\/)?(\d+)/i);
      const queryMatch = parsedId.match(/[?&]id=(\d+)/i);
      if (ipMatch && ipMatch[1]) {
        parsedId = ipMatch[1];
      } else if (queryMatch && queryMatch[1]) {
        parsedId = queryMatch[1];
      } else {
        // Fallback: extract any contiguous block of digits that looks like an ID
        const digits = parsedId.match(/\b\d{7,11}\b/);
        if (digits) {
          parsedId = digits[0];
        }
      }
    }

    onUpdateItem({
      ...item,
      walmartItemId: parsedId || undefined
    });

    setLinkingItemId(null);
    setLinkInputValue('');
  };

  const selectAll = () => {
    const updated: Record<string, boolean> = {};
    checkoutableItems.forEach(item => {
      updated[item.id] = true;
    });
    setSelectedItemIds(updated);
  };

  const deselectAll = () => {
    const updated: Record<string, boolean> = {};
    checkoutableItems.forEach(item => {
      updated[item.id] = false;
    });
    setSelectedItemIds(updated);
  };

  const handleCheckout = async () => {
    const activeItems = checkoutableItems.filter(item => selectedItemIds[item.id]);
    
    if (activeItems.length === 0) return;

    if (selectedRetailer === 'walmart') {
      const matchedItems = activeItems.filter(item => hasWalmartMatch(item));
      const unmatchedItems = activeItems.filter(item => !hasWalmartMatch(item));

      // 1. If we have matched items, add them to cart
      if (matchedItems.length > 0) {
        const cartUrl = generateWalmartCartUrl(matchedItems);
        if (cartUrl) {
          const trackedUrl = wrapWithImpactTracker(cartUrl, 'walmart');
          await Browser.open({ url: trackedUrl });
        }
      }

      // 2. For unmatched items, open search URLs
      if (unmatchedItems.length > 0) {
        const searchUrl = generateSearchUrl(unmatchedItems[0].item, 'walmart');
        const trackedSearchUrl = wrapWithImpactTracker(searchUrl, 'walmart');
        await Browser.open({ url: trackedSearchUrl });
      }
    } else {
      // General Merchant Search Redirection Flow
      // Open the search query for the first selected item to drop the cookie!
      const firstItem = activeItems[0];
      const searchUrl = generateSearchUrl(firstItem.item, selectedRetailer);
      const trackedSearchUrl = wrapWithImpactTracker(searchUrl, selectedRetailer);
      await Browser.open({ url: trackedSearchUrl });
    }

    onClose();
  };

  const activeItems = checkoutableItems.filter(item => selectedItemIds[item.id]);
  const matchedCount = activeItems.filter(item => hasWalmartMatch(item)).length;
  const unmatchedCount = activeItems.length - matchedCount;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-primary border border-theme rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] text-theme-primary transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-[var(--accent-color)]" />
            <h3 className="text-xl font-bold font-playfair">Order Ingredients Online</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-theme-secondary text-theme-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Retailer Selector Grid */}
        <div className="p-4 border-b border-theme bg-theme-secondary/40 grid grid-cols-3 gap-2.5">
          {(
            [
              { id: 'walmart', name: 'Walmart', subtitle: 'Direct Cart' },
              { id: 'target', name: 'Target', subtitle: 'Shop Online' },
              { id: 'kroger', name: 'Kroger', subtitle: 'Shop Online' },
              { id: 'instacart', name: 'Instacart', subtitle: 'Shop Online' },
              { id: 'albertsons', name: 'Safeway', subtitle: 'Shop Online' },
              { id: 'thrive', name: 'Thrive Mkt', subtitle: 'Shop Online' },
            ] as const
          ).map(merchant => (
            <button
              key={merchant.id}
              onClick={() => setSelectedRetailer(merchant.id)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                selectedRetailer === merchant.id
                  ? 'border-[var(--accent-color)] bg-theme-secondary text-theme-primary shadow-lg ring-1 ring-[var(--accent-color)]'
                  : 'border-transparent bg-theme-secondary/50 text-theme-secondary hover:bg-theme-secondary'
              }`}
            >
              <span className="font-bold text-xs tracking-wider uppercase text-center">{merchant.name}</span>
              <span className={`text-[10px] mt-0.5 font-semibold text-center leading-none ${
                selectedRetailer === merchant.id ? 'text-[var(--accent-color)]' : 'text-theme-secondary'
              }`}>
                {merchant.subtitle}
              </span>
            </button>
          ))}
        </div>

        {/* Selection Actions */}
        <div className="px-5 py-3 flex justify-between items-center text-xs border-b border-theme bg-theme-primary">
          <span className="text-theme-secondary font-medium">
            {activeItems.length} of {checkoutableItems.length} ingredients selected
          </span>
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-[var(--accent-color)] hover:underline font-semibold">Select All</button>
            <span className="text-theme-secondary opacity-40">|</span>
            <button onClick={deselectAll} className="text-[var(--accent-color)] hover:underline font-semibold">Clear All</button>
          </div>
        </div>

        {/* Ingredients Checklist */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {sortedCheckoutableItems.length === 0 ? (
            <div className="text-center py-8 text-theme-secondary">
              Your shopping list is empty. Add ingredients to get started!
            </div>
          ) : (
            sortedCheckoutableItems.map(item => {
              const isSelected = !!selectedItemIds[item.id];
              const isMatched = selectedRetailer === 'walmart' && hasWalmartMatch(item);
              const isLinking = linkingItemId === item.id;

              return (
                <div 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[var(--accent-color)] bg-theme-secondary/40' 
                      : 'border-theme bg-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        isSelected 
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white' 
                          : 'border-theme'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-theme-primary">{item.item}</p>
                        <p className="text-xs text-theme-secondary">
                          {item.quantity ? String(item.quantity) : '1 unit'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedRetailer === 'walmart' && (
                        <>
                          <button
                            onClick={(e) => handleStartLink(e, item)}
                            className="p-1 rounded bg-theme-secondary text-theme-secondary hover:bg-theme-primary transition-colors border border-theme"
                            title="Paste custom Walmart Item ID or URL"
                          >
                            <Link2 className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                          </button>
                          
                          {isMatched ? (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Auto-Cart
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold flex items-center gap-1">
                              <Search className="w-3 h-3" /> Search
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Custom link input section */}
                  {selectedRetailer === 'walmart' && isLinking && (
                    <div className="mt-2.5 pt-2.5 border-t border-theme/40 flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={linkInputValue}
                        onChange={(e) => setLinkInputValue(e.target.value)}
                        placeholder="Paste Walmart item URL or ID (e.g. 660768274)"
                        className="flex-1 bg-theme-primary border border-theme rounded-lg px-2.5 py-1 text-xs text-theme-primary focus:outline-none focus:border-[var(--accent-color)]"
                        autoFocus
                      />
                      <button
                        onClick={(e) => handleSaveLink(e, item)}
                        className="px-3 py-1 bg-[var(--accent-color)] hover:opacity-90 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setLinkingItemId(null); }}
                        className="px-2 py-1 bg-transparent hover:bg-theme-secondary text-theme-secondary rounded-lg text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="p-5 pb-14 border-t border-theme bg-theme-secondary/20">
          {selectedRetailer === 'walmart' && activeItems.length > 0 && (
            <div className="mb-4 text-xs text-theme-secondary space-y-1 bg-theme-secondary/40 p-3 rounded-xl border border-theme/40">
              {matchedCount > 0 && (
                <p className="flex items-center gap-1.5 text-emerald-500">
                  <Check className="w-4 h-4" /> <strong>{matchedCount} matched items</strong> will be added directly to your cart.
                </p>
              )}
              {unmatchedCount > 0 && (
                <p className="flex items-center gap-1.5 text-amber-500">
                  <Search className="w-4 h-4" /> <strong>{unmatchedCount} unmatched items</strong> will open in search.
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={activeItems.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[var(--accent-color)] hover:opacity-95 text-white font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <span>Proceed to {{
              walmart: 'Walmart',
              target: 'Target',
              kroger: 'Kroger',
              instacart: 'Instacart',
              albertsons: 'Safeway',
              thrive: 'Thrive Market'
            }[selectedRetailer]}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
