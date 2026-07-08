import React, { useState } from 'react';
import { X, Check, Search, ShoppingBag, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ShoppingItem } from '../../types';
import { Browser } from '@capacitor/browser';
import {
  generateWalmartCartUrl,
  generateWalmartSearchUrl,
  hasWalmartMatch,
  wrapWithImpactTracker
} from '../../services/groceryCheckoutService';

interface RetailCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
}

export const RetailCheckoutModal: React.FC<RetailCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const [selectedRetailer, setSelectedRetailer] = useState<'walmart' | 'instacart'>('walmart');
  
  // Filter only unchecked items for checkout
  const checkoutableItems = items.filter(item => !item.checked);
  
  // Track which items the user has checked for inclusion
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    checkoutableItems.forEach(item => {
      initial[item.id] = true;
    });
    return initial;
  });

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
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
          const trackedUrl = wrapWithImpactTracker(cartUrl);
          await Browser.open({ url: trackedUrl });
        }
      }

      // 2. For unmatched items, open search URLs (limit to first 3 to avoid spamming tabs, or prompt the user)
      if (unmatchedItems.length > 0) {
        // Open the search link for the first unmatched item as a convenience
        const searchUrl = generateWalmartSearchUrl(unmatchedItems[0].item);
        const trackedSearchUrl = wrapWithImpactTracker(searchUrl);
        await Browser.open({ url: trackedSearchUrl });
      }
    } else {
      // Instacart Search Redirection Flow
      // Link user to partner search for the first selected item, or standard instacart store locator
      const firstItem = activeItems[0];
      const searchUrl = `https://www.instacart.com/store/partner/search/${encodeURIComponent(firstItem.item)}`;
      await Browser.open({ url: searchUrl });
    }

    onClose();
  };

  const activeItems = checkoutableItems.filter(item => selectedItemIds[item.id]);
  const matchedCount = activeItems.filter(item => hasWalmartMatch(item)).length;
  const unmatchedCount = activeItems.length - matchedCount;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#2A0A10] border border-[#52151C] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] text-[#F3F4F6]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#52151C]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-[#F59E0B]" />
            <h3 className="text-xl font-bold font-playfair">Order Ingredients Online</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-[#3F1016] text-[#FECACA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Retailer Selector */}
        <div className="p-5 border-b border-[#52151C] bg-[#3F1016]/40 flex gap-4">
          <button
            onClick={() => setSelectedRetailer('walmart')}
            className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all ${
              selectedRetailer === 'walmart'
                ? 'border-[#F59E0B] bg-[#52151C]/60 text-white shadow-lg'
                : 'border-transparent bg-[#2A0A10]/50 text-gray-400 hover:bg-[#2A0A10]'
            }`}
          >
            <span className="font-bold text-sm tracking-wider uppercase">Walmart</span>
            <span className="text-xs text-[#F59E0B] mt-1 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Direct Cart Sync
            </span>
          </button>
          <button
            onClick={() => setSelectedRetailer('instacart')}
            className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all ${
              selectedRetailer === 'instacart'
                ? 'border-[#F59E0B] bg-[#52151C]/60 text-white shadow-lg'
                : 'border-transparent bg-[#2A0A10]/50 text-gray-400 hover:bg-[#2A0A10]'
            }`}
          >
            <span className="font-bold text-sm tracking-wider uppercase">Instacart</span>
            <span className="text-xs text-gray-400 mt-1">Search & Shop</span>
          </button>
        </div>

        {/* Selection Actions */}
        <div className="px-5 py-3 flex justify-between items-center text-xs border-b border-[#52151C] bg-[#2A0A10]">
          <span className="text-[#FECACA] font-medium">
            {activeItems.length} of {checkoutableItems.length} ingredients selected
          </span>
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-[#F59E0B] hover:underline font-semibold">Select All</button>
            <span className="text-gray-600">|</span>
            <button onClick={deselectAll} className="text-[#F59E0B] hover:underline font-semibold">Clear All</button>
          </div>
        </div>

        {/* Ingredients Checklist */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {checkoutableItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Your shopping list is empty. Add ingredients to get started!
            </div>
          ) : (
            checkoutableItems.map(item => {
              const isSelected = !!selectedItemIds[item.id];
              const isMatched = selectedRetailer === 'walmart' && hasWalmartMatch(item);

              return (
                <div 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#52151C] bg-[#3F1016]/30' 
                      : 'border-[#3F1016]/40 bg-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                      isSelected 
                        ? 'bg-[#F59E0B] border-[#F59E0B] text-black' 
                        : 'border-[#52151C]'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{item.item}</p>
                      <p className="text-xs text-[#FECACA]/70">
                        {item.quantity ? String(item.quantity) : '1 unit'}
                      </p>
                    </div>
                  </div>

                  {selectedRetailer === 'walmart' && (
                    <div className="flex items-center gap-1.5">
                      {isMatched ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Auto-Cart
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-900/50 text-[#F59E0B] font-semibold flex items-center gap-1">
                          <Search className="w-3 h-3" /> Search
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="p-5 border-t border-[#52151C] bg-[#3F1016]/20">
          {selectedRetailer === 'walmart' && activeItems.length > 0 && (
            <div className="mb-4 text-xs text-[#FECACA]/80 space-y-1 bg-[#3F1016]/40 p-3 rounded-xl border border-[#52151C]/40">
              {matchedCount > 0 && (
                <p className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-4 h-4" /> <strong>{matchedCount} matched items</strong> will be added directly to your cart.
                </p>
              )}
              {unmatchedCount > 0 && (
                <p className="flex items-center gap-1.5 text-[#F59E0B]">
                  <Search className="w-4 h-4" /> <strong>{unmatchedCount} unmatched items</strong> will open in search.
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={activeItems.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/95 text-black font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <span>Proceed to {selectedRetailer === 'walmart' ? 'Walmart' : 'Instacart'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
