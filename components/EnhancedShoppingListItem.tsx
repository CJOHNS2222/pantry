import React, { useState, useRef } from 'react';
import { Check, Trash2, Calculator, MessageSquare, UserCheck, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShoppingItem } from '../types';
import { comparePriceOptions, formatPricePerUnit, getPriceComparisonSummary } from '../utils/priceCalculator';
import { useAndroidBack } from '../hooks/useAndroidBack';
import HapticService from '../services/hapticService';

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
  const [isOpen, setIsOpen] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(item.notes ?? '');
  const itemRef = useRef<HTMLDivElement>(null);

  // Register Android system back button hooks for overlays
  useAndroidBack(showAssignPicker, () => setShowAssignPicker(false));
  useAndroidBack(showNotes, () => setShowNotes(false));

  const hasNoteButton = !!onUpdateItem;
  const drawerWidth = hasNoteButton ? 140 : 70;
  const swipeOffset = isOpen ? -drawerWidth : 0;

  const [showPriceComparison, setShowPriceComparison] = useState(false);

  const priceComparisons = item.priceOptions && item.priceOptions.length > 1
    ? comparePriceOptions(item.priceOptions)
    : [];

  const priceComparisonSummary = item.priceOptions && item.priceOptions.length > 1
    ? getPriceComparisonSummary(item.priceOptions)
    : '';

  const pointerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressing = useRef(false);

  const handlePointerDown = (_e: React.PointerEvent) => {
    isLongPressing.current = false;
    pointerTimer.current = setTimeout(() => {
      isLongPressing.current = true;
      HapticService.medium();
      if (onLongPress) {
        onLongPress(item.id);
      }
    }, 600);
  };

  const handlePointerUpOrLeave = () => {
    if (pointerTimer.current) {
      clearTimeout(pointerTimer.current);
      pointerTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressing.current) {
      e.stopPropagation();
      e.preventDefault();
      isLongPressing.current = false;
      return;
    }
    if (isOpen) {
      e.stopPropagation();
      setIsOpen(false);
      return;
    }
    HapticService.light();
    onToggleCheck(item.id);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe Actions Drawer - sits underneath the card on the right side */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch z-0 overflow-hidden rounded-r-xl"
        style={{ width: `${drawerWidth}px` }}
      >
        {/* Note Button */}
        {hasNoteButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNotes(prev => !prev);
              setShowAssignPicker(false);
              if (!showNotes) setNoteText(item.notes ?? '');
              setIsOpen(false);
            }}
            className="flex-1 flex flex-col items-center justify-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title={item.notes ? 'Edit note' : 'Add note'}
            aria-label="Edit note"
          >
            <MessageSquare className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-medium">Note</span>
          </button>
        )}

        {/* Delete/Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
            setIsOpen(false);
          }}
          className="flex-1 flex flex-col items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors"
          aria-label={`Remove ${item.item}`}
        >
          <Trash2 className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Main Item */}
      <div
        ref={itemRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        className={`flex items-start justify-between gap-3 p-4 bg-theme-secondary border border-theme rounded-xl transition-all cursor-pointer group relative z-10 ${
          isSelected
            ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
            : 'hover:border-[var(--accent-color)]/50'
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
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

          {/* Chevron Reveal Tab */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-60 hover:opacity-100 hover:text-[var(--accent-color)] transition-opacity"
            title={isOpen ? 'Close actions' : 'More actions'}
            aria-label={isOpen ? 'Close actions' : 'More actions'}
          >
            {isOpen ? <ChevronRight className="w-4 h-4 text-[var(--accent-color)]" /> : <ChevronLeft className="w-4 h-4" />}
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