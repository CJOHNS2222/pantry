import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { getItemImage, inferCategoryFromItemName } from '../../utils/appUtils';

interface QuickAddProps {
  /** Items to display as tap-to-add chips. Already filtered for what's relevant. */
  suggestedItems: string[];
  /** Called when the user taps a chip. ShoppingList owns the actual add logic. */
  onAddItem: (itemName: string) => void;
}

/**
 * Horizontally-scrollable row of suggestion chips.
 * Each chip shows an image + label; tapping it calls onAddItem and briefly
 * flashes a checkmark so the user knows the tap registered.
 */
export const QuickAdd: React.FC<QuickAddProps> = ({ suggestedItems, onAddItem }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  // Keep arrow visibility in sync with scroll position
  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncArrows();
    // Re-check when the list of items changes (e.g. filtered items shrink)
  }, [suggestedItems, syncArrows]);

  const scrollBy = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -180 : 180, behavior: 'smooth' });
  };

  const handleAdd = (itemName: string) => {
    onAddItem(itemName);

    // Brief visual confirmation
    setJustAdded(prev => new Set([...prev, itemName]));
    setTimeout(() => {
      setJustAdded(prev => {
        const next = new Set(prev);
        next.delete(itemName);
        return next;
      });
    }, 900);
  };

  if (suggestedItems.length === 0) return null;

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme px-3 pt-3 pb-2 mb-3">
      <p className="text-xs font-semibold text-theme-secondary/70 uppercase tracking-wide mb-2 px-0.5">
        Quick Add
      </p>

      <div className="relative">
        {/* Left scroll arrow */}
        {showLeft && (
          <button
            onClick={() => scrollBy('left')}
            style={{ touchAction: 'manipulation' }}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center
                       rounded-full bg-theme-primary/90 shadow border border-theme
                       text-theme-primary hover:bg-[var(--accent-color)] hover:text-white
                       active:scale-90 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Right scroll arrow */}
        {showRight && (
          <button
            onClick={() => scrollBy('right')}
            style={{ touchAction: 'manipulation' }}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center
                       rounded-full bg-theme-primary/90 shadow border border-theme
                       text-theme-primary hover:bg-[var(--accent-color)] hover:text-white
                       active:scale-90 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Left fade when scrolled */}
        {showLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-theme-secondary to-transparent z-[5] pointer-events-none" />
        )}
        {/* Right fade when more content exists */}
        {showRight && (
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-theme-secondary to-transparent z-[5] pointer-events-none" />
        )}

        {/* Scrollable chip row */}
        <div
          ref={scrollRef}
          onScroll={syncArrows}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {suggestedItems.map(itemName => {
            const added = justAdded.has(itemName);
            return (
              <button
                key={itemName}
                onClick={() => handleAdd(itemName)}
                style={{ touchAction: 'manipulation', scrollSnapAlign: 'start' }}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 w-[72px] py-2 rounded-xl border
                            transition-all duration-200 active:scale-95 select-none
                            ${added
                              ? 'bg-green-500/10 border-green-400 text-green-500'
                              : 'bg-theme-primary border-theme text-theme-primary hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5'
                            }`}
              >
                {added ? (
                  <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-500" strokeWidth={2.5} />
                  </div>
                ) : (
                  <img
                    src={getItemImage(itemName, inferCategoryFromItemName(itemName))}
                    alt={itemName}
                    loading="lazy"
                    className="w-10 h-10 rounded-lg object-cover bg-theme-secondary border border-theme"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/placeholder.svg';
                    }}
                  />
                )}
                <span className="text-[10px] font-medium leading-tight text-center w-full px-1 truncate">
                  {itemName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuickAdd;
