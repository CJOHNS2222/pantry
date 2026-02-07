import React, { useState, useRef, useEffect } from 'react';
import { Check, Undo2, Package, ShoppingCart } from 'lucide-react';
import { ShoppingItem } from '../types';

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
  isOffline?: boolean;
  lastSynced?: Date;
}

export const EnhancedShoppingListItem: React.FC<ShoppingListItemProps> = ({
  item,
  onToggleCheck,
  onRemove,
  onUndo,
  isOffline = false,
  lastSynced
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const [showUndo, setShowUndo] = useState(false);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;

  useEffect(() => {
    if (item.checked && !showUndo) {
      setShowUndo(true);
      const timer = setTimeout(() => setShowUndo(false), 5000); // Hide undo after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [item.checked, showUndo]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // Only allow left swipe (negative diff)
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -MAX_SWIPE));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;

    setIsSwiping(false);

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      // Swipe completed
      if (!item.checked) {
        onToggleCheck(item.id);
      }
      setSwipeOffset(0);
    } else {
      // Reset position
      setSwipeOffset(0);
    }
  };

  const handleClick = () => {
    if (!isSwiping) {
      onToggleCheck(item.id);
    }
  };

  const getSwipeActionColor = () => {
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      return 'bg-green-500';
    }
    return 'bg-green-400';
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe Action Background */}
      <div
        className={`absolute inset-y-0 right-0 ${getSwipeActionColor()} flex items-center justify-end px-4 transition-all duration-200`}
        style={{ width: Math.max(0, -swipeOffset) }}
      >
        <div className="flex items-center gap-2 text-white">
          <span className="text-sm font-medium">
            {Math.abs(swipeOffset) > SWIPE_THRESHOLD ? 'Check Off' : 'Swipe to Check'}
          </span>
          <Check className="w-5 h-5" />
        </div>
      </div>

      {/* Main Item */}
      <div
        ref={itemRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={`flex items-center justify-between p-3 bg-theme-secondary border border-theme rounded-xl transition-all cursor-pointer group relative ${
          item.checked
            ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
            : 'hover:border-[var(--accent-color)]/50'
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'all 0.3s ease'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            item.checked ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-theme'
          }`}>
            {item.checked && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1">
            <span className={`font-medium ${item.checked ? 'line-through opacity-50' : 'text-theme-primary'}`}>
              {item.item}
            </span>
            {item.source && (
              <div className="text-xs text-theme-secondary opacity-60 mt-1">
                {item.source === 'suggested' && '💡 Suggested item'}
                {item.source === 'manual' && '✏️ Manually added'}
                {item.source === 'meal planner' && '📅 From meal planner'}
                {item.source === 'pantry scanner' && '📷 From pantry scanner'}
                {item.source === 'scanner suggestion' && '🤖 Scanner suggestion'}
                {item.source?.startsWith('recipe:') && `🍳 ${item.source.substring(8)}`}
              </div>
            )}
            {item.quantity && item.quantity !== '1' && (
              <div className="text-xs text-theme-secondary opacity-70">Needed: {item.quantity}</div>
            )}
            {isOffline && lastSynced && (
              <div className="text-xs text-orange-600 opacity-70 mt-1">
                ⚠️ Offline - Last synced: {lastSynced.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.quantity && item.quantity !== '1' && (
            <div className="text-xs font-medium text-theme-secondary opacity-70 bg-theme-primary px-2 py-1 rounded">
              {item.quantity}
            </div>
          )}

          {/* Undo Button - Show when recently checked */}
          {showUndo && item.checked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUndo(item.id);
                setShowUndo(false);
              }}
              className="p-2 text-orange-500 hover:text-orange-600 transition-colors animate-fade-in"
              title="Undo checkmark"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          {/* Remove Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="p-2 text-theme-secondary opacity-30 hover:opacity-100 hover:text-red-500 transition-opacity"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedShoppingListItem;