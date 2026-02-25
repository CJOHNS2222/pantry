import React, { useState, useRef, useEffect } from 'react';
import { Check, Undo2, Package, ShoppingCart, Trash2 } from 'lucide-react';
import { ShoppingItem } from '../types';

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onLongPress?: (id: string) => void;
  isSelected?: boolean;
  isOffline?: boolean;
  lastSynced?: Date;
}

export const EnhancedShoppingListItem: React.FC<ShoppingListItemProps> = ({
  item,
  onToggleCheck,
  onRemove,
  onLongPress,
  isSelected = false,
  isOffline = false,
  lastSynced
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;
  const LONG_PRESS_DELAY = 500;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);

    // Start long press timer
    const timer = setTimeout(() => {
      if (onLongPress && !isSwiping) {
        onLongPress(item.id);
      }
    }, LONG_PRESS_DELAY);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // Clear long press timer if user starts swiping
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Only allow right swipe (positive diff) to mark as done
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, MAX_SWIPE));
    }
  };

  const handleTouchEnd = () => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (!isSwiping) return;

    setIsSwiping(false);

    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      // Swipe completed - remove item
      onRemove(item.id);
      setSwipeOffset(0);
    } else {
      // Reset position
      setSwipeOffset(0);
    }
  };

  const handleClick = () => {
    // Only handle click if not swiping and long press timer has cleared
    if (!isSwiping && !longPressTimer) {
      onToggleCheck(item.id);
    }
  };

  const getSwipeActionColor = () => {
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      return 'bg-red-500';
    }
    return 'bg-red-400';
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe Action Background - Left side for right swipe */}
      <div
        className={`absolute inset-y-0 left-0 ${getSwipeActionColor()} flex items-center justify-start px-4 transition-all duration-200`}
        style={{ width: Math.max(0, swipeOffset) }}
      >
        <div className="flex items-center gap-2 text-white">
          <Trash2 className="w-5 h-5" />
          <span className="text-sm font-medium">
            {Math.abs(swipeOffset) > SWIPE_THRESHOLD ? 'Delete' : 'Swipe to Delete'}
          </span>
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
          isSelected
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
            isSelected ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-theme'
          }`}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1">
            <span className="font-medium text-theme-primary">
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
            {item.purchasedBatch && (
              <div className="text-xs text-green-600 opacity-90 mt-1">Purchased: {item.purchasedBatch.amount} {item.purchasedBatch.unit || ''} {item.purchasedBatch.expires ? `— expires ${item.purchasedBatch.expires}` : ''}</div>
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
          {item.estimatedPrice && item.estimatedPrice > 0 && (
            <div className="text-xs font-medium text-green-600 opacity-70 bg-green-50 px-2 py-1 rounded border border-green-200">
              ~${item.estimatedPrice.toFixed(2)}
            </div>
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