import React, { useState, useRef } from 'react';
import { Check, Trash2, Calculator, MessageSquare, UserCheck, X } from 'lucide-react';
import { ShoppingItem } from '../types';
import { comparePriceOptions, formatPricePerUnit, getPriceComparisonSummary } from '../utils/priceCalculator';

interface HouseholdMember {
  id: string;
  name: string;
  avatar?: string;
}

interface ShoppingListItemProps {
  item: ShoppingItem;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
  onQuantityChange?: (id: string, quantity: string) => void;
  onLongPress?: (id: string) => void;
  onUpdateItem?: (id: string, updates: Partial<ShoppingItem>) => void;
  householdMembers?: HouseholdMember[];
  isSelected?: boolean;
  isOffline?: boolean;
  lastSynced?: Date;
  showPriceData?: boolean;
}

export const EnhancedShoppingListItem: React.FC<ShoppingListItemProps> = ({
  item,
  onToggleCheck,
  onRemove,
  onQuantityChange,
  onLongPress,
  onUpdateItem,
  householdMembers,
  isSelected = false,
  isOffline = false,
  lastSynced,
  showPriceData = false,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(item.notes ?? '');
  const itemRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 120;
  const LONG_PRESS_DELAY = 500;

  const [showPriceComparison, setShowPriceComparison] = useState(false);

  const priceComparisons = item.priceOptions && item.priceOptions.length > 1
    ? comparePriceOptions(item.priceOptions)
    : [];

  const priceComparisonSummary = item.priceOptions && item.priceOptions.length > 1
    ? getPriceComparisonSummary(item.priceOptions)
    : '';

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
        className={`flex items-start justify-between gap-3 p-4 bg-theme-secondary border border-theme rounded-xl transition-all cursor-pointer group relative ${
          isSelected
            ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
            : 'hover:border-[var(--accent-color)]/50'
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'all 0.3s ease'
        }}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 flex-shrink-0 ${
            isSelected ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-theme'
          }`}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <span className="block text-base font-semibold text-theme-primary leading-snug">
              {item.item}
            </span>
            {item.source && (
              <div className="inline-flex items-center rounded-full border border-theme bg-theme-primary/50 px-2.5 py-1 text-xs font-medium text-theme-secondary">
                {item.source === 'suggested' && '💡 Suggested item'}
                {item.source === 'manual' && '✏️ Manually added'}
                {item.source === 'meal planner' && '📅 From meal planner'}
                {item.source === 'pantry scanner' && '📷 From pantry scanner'}
                {item.source === 'scanner suggestion' && '🤖 Scanner suggestion'}
                {item.source?.startsWith('recipe:') && `🍳 ${item.source.substring(8).replace(/^need\s+/, '')}`}
              </div>
            )}
            {item.quantity && item.quantity !== '1' && (
              <div className="text-sm text-theme-secondary opacity-80">Needed: {item.quantity}</div>
            )}
            {item.purchasedBatch && (
              <div className="text-sm text-green-600 opacity-90">Purchased: {item.purchasedBatch.amount} {item.purchasedBatch.unit || ''} {item.purchasedBatch.expires ? `— expires ${item.purchasedBatch.expires}` : ''}</div>
            )}
            {item.assignedTo && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm bg-[var(--accent-color)]/15 text-[var(--accent-color)] px-2 py-0.5 rounded-full font-medium">
                  👤 {item.assignedTo}
                </span>
              </div>
            )}
            {item.notes && !showNotes && (
              <div className="text-sm text-theme-secondary opacity-70 italic truncate max-w-[180px]">
                📝 {item.notes}
              </div>
            )}
            {isOffline && lastSynced && (
              <div className="text-sm text-orange-600 opacity-80">
                ⚠️ Offline - Last synced: {lastSynced.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Assign Button */}
          {onUpdateItem && householdMembers && householdMembers.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssignPicker(!showAssignPicker);
                  setShowNotes(false);
                }}
                className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-opacity ${
                  item.assignedTo
                    ? 'text-[var(--accent-color)] opacity-90 hover:opacity-100'
                    : 'text-theme-secondary opacity-40 hover:opacity-80'
                }`}
                title={item.assignedTo ? `Assigned to ${item.assignedTo}` : 'Assign to member'}
                aria-label="Assign item"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Notes Button */}
          {onUpdateItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNotes(!showNotes);
                setShowAssignPicker(false);
                if (!showNotes) setNoteText(item.notes ?? '');
              }}
              className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-opacity ${
                item.notes
                  ? 'text-[var(--accent-color)] opacity-90 hover:opacity-100'
                  : 'text-theme-secondary opacity-40 hover:opacity-80'
              }`}
              title={item.notes ? 'Edit note' : 'Add note'}
              aria-label="Toggle notes"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {onQuantityChange && (
            <input
              type="text"
              value={item.quantity || ''}
              onChange={(e) => onQuantityChange(item.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-16 px-2 py-1 text-sm border border-theme rounded bg-theme-primary text-theme-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
              placeholder="qty"
            />
          )}
          {showPriceData && item.estimatedPrice && item.estimatedPrice > 0 && (
            <div className="text-sm font-medium text-green-600 opacity-80 bg-green-50 px-2 py-1 rounded border border-green-200">
              ~${item.estimatedPrice.toFixed(2)}
            </div>
          )}

          {/* Price Comparison */}
          {showPriceData && item.priceOptions && item.priceOptions.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPriceComparison(!showPriceComparison);
              }}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-60 hover:opacity-100 hover:text-[var(--accent-color)] transition-opacity"
              title="Compare prices"
              aria-label="Compare prices"
            >
              <Calculator className="w-4 h-4" />
            </button>
          )}

          {/* Remove Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-30 hover:opacity-100 hover:text-red-500 transition-opacity"
            aria-label={`Remove ${item.item}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Assignment Picker */}
      {showAssignPicker && onUpdateItem && householdMembers && householdMembers.length > 0 && (
        <div className="mt-1 p-2 bg-theme-secondary border border-theme rounded-lg">
          <div className="text-xs font-medium text-theme-secondary mb-2">Assign to:</div>
          <div className="flex flex-wrap gap-2">
            {householdMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onUpdateItem(item.id, { assignedTo: item.assignedTo === member.name ? undefined : member.name });
                  setShowAssignPicker(false);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  item.assignedTo === member.name
                    ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]'
                    : 'bg-theme text-theme-primary border-theme hover:border-[var(--accent-color)]'
                }`}
              >
                {member.name}
              </button>
            ))}
            {item.assignedTo && (
              <button
                onClick={() => {
                  onUpdateItem(item.id, { assignedTo: undefined });
                  setShowAssignPicker(false);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-theme text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Unassign
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notes Editor */}
      {showNotes && onUpdateItem && (
        <div className="mt-1 p-2 bg-theme-secondary border border-theme rounded-lg">
          <div className="text-xs font-medium text-theme-secondary mb-1">Note:</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => {
              onUpdateItem(item.id, { notes: noteText.trim() || undefined });
            }}
            onClick={(e) => e.stopPropagation()}
            rows={2}
            placeholder="Add a note (e.g. low fat, organic brand)…"
            className="w-full text-xs px-2 py-1.5 bg-theme border border-theme rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] text-theme-primary resize-none"
          />
        </div>
      )}

      {/* Price Comparison Details */}
      {showPriceData && showPriceComparison && item.priceOptions && item.priceOptions.length > 1 && (
        <div className="mt-2 p-3 bg-theme-secondary/50 border border-theme rounded-lg">
          <div className="text-xs font-medium text-theme-primary mb-2">
            Price Comparison {priceComparisonSummary && `• ${priceComparisonSummary}`}
          </div>
          <div className="space-y-2">
            {item.priceOptions.map((option, index) => {
              const comparison = priceComparisons[index];
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded border ${
                    comparison?.isBestValue
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-theme border-theme'
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {option.amount}{option.unit} for ${option.price.toFixed(2)}
                      {option.store && <span className="text-xs opacity-70 ml-1">at {option.store}</span>}
                    </div>
                    <div className="text-xs opacity-70">
                      {formatPricePerUnit(comparison?.pricePerUnit || 0, comparison?.unit || option.unit)}
                      {comparison?.isBestValue && (
                        <span className="ml-2 text-green-600 font-medium">✨ Best value</span>
                      )}
                    </div>
                  </div>
                  {comparison?.savings && comparison.savings > 0 && (
                    <div className="text-xs text-red-600 font-medium">
                      Save ${comparison.savings.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedShoppingListItem;