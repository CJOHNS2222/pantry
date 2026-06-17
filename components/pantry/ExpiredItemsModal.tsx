import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useModalOpen } from '../../utils/useModalOpen';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PantryItem } from '../../types';

import { getQuantityAmount } from '../../utils/quantityUtils';
import AnalyticsService from '../../services/analyticsService';
import HapticService from '../../services/hapticService';
import FoodWasteAnalyticsService from '../../services/foodWasteAnalyticsService';
import { log } from '../../services/logService';
import { useIntl } from 'react-intl';

interface ExpiredItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: PantryItem[];
  onRemoveItems: (itemIds: string[], disposalReason: string) => Promise<void>;
  householdId?: string;
  userId?: string;
  userName?: string;
  specificItems?: PantryItem[]; // Optional: show specific items instead of all expired items
}

type DisposalReason = 'thrown_away' | 'cooked' | 'remove';

const ExpiredItemsModal: React.FC<ExpiredItemsModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onRemoveItems,
  householdId,
  userId,
  userName,
  specificItems
}) => {
  useModalOpen(isOpen);
  const modalRef = useFocusTrap({ isActive: isOpen });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [disposalReason, setDisposalReason] = useState<DisposalReason>('thrown_away');
  const [isProcessing, setIsProcessing] = useState(false);
  const intl = useIntl();
  const [expiredItems, setExpiredItems] = useState<PantryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (specificItems) {
        // Use specific items from notification
        setExpiredItems(specificItems);
        setSelectedItems(new Set());

        // Track modal opened
        AnalyticsService.trackEvent('expired_items_modal_opened', {
          expired_count: specificItems.length,
          source: 'notification'
        });
      } else {
        // Get expired items using the same logic as generateExpirationAlerts
        const today = new Date().toISOString().slice(0, 10);
        const expired = inventory.filter(item => {
          if (!item.expirationDate || item.is_immortal) return false;
          // Frozen items use freezerExpiry; don't flag them based on old fridge-date
          if (item.is_frozen || item.storageLocation === 'freezer') {
            const ref = item.freezerExpiry || item.expirationDate;
            return ref <= today;
          }
          return item.expirationDate <= today;
        });
        setExpiredItems(expired);
        setSelectedItems(new Set());

        // Track modal opened
        AnalyticsService.trackEvent('expired_items_modal_opened', {
          expired_count: expired.length
        });
      }
    }
  }, [isOpen, inventory, specificItems]);

  const getDaysExpired = (expirationDate: string): number => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = today.getTime() - expDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    HapticService.light();
  };

  const handleSelectAll = () => {
    if (selectedItems.size === expiredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(expiredItems.map(item => item.id)));
    }
    HapticService.light();
  };

  const handleRemoveSelected = async () => {
    if (selectedItems.size === 0) return;

    setIsProcessing(true);
    try {
      const reason = disposalReason;
      await onRemoveItems(Array.from(selectedItems), reason);

      // Record analytics for each disposed item
      for (const itemId of selectedItems) {
        const item = expiredItems.find(i => i.id === itemId);
        if (item && userId) {
          const daysExpired = getDaysExpired(item.expirationDate!);
          const estimatedValue = 2.50; // Rough estimate per item

          await FoodWasteAnalyticsService.recordDisposal({
            itemId: item.id,
            itemName: item.item,
            category: item.category,
            disposalReason: reason,
            daysExpired,
            userId,
            userName,
            estimatedValue
          }, householdId);
        }
      }

      // Track removal analytics
      AnalyticsService.trackEvent('expired_items_removed', {
        count: selectedItems.size,
        disposal_reason: reason,
        items: Array.from(selectedItems).map(id => {
          const item = expiredItems.find(i => i.id === id);
          return {
            name: item?.item,
            days_expired: item?.expirationDate ? getDaysExpired(item.expirationDate) : 0,
            category: item?.category
          };
        })
      });

      HapticService.success();
      onClose();
    } catch (error) {
      log.error('Failed to remove expired items:', error);
      HapticService.error();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    AnalyticsService.trackEvent('expired_items_modal_skipped', {
      expired_count: expiredItems.length
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Expired Items" className="bg-theme-primary rounded-2xl border border-theme max-w-2xl w-full h-full flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-primary">{intl.formatMessage({ id: 'pantry.expired.title' })}</h2>
              <p className="text-sm text-theme-secondary opacity-70">
                {expiredItems.length} item{expiredItems.length !== 1 ? 's' : ''} need{expiredItems.length === 1 ? 's' : ''} attention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-theme-secondary hover:bg-theme-primary flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-theme-primary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {expiredItems.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-theme-secondary">No expired items found!</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-[var(--accent-color)] hover:underline"
                >
                  {selectedItems.size === expiredItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-theme-secondary">
                  {selectedItems.size} of {expiredItems.length} selected
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {expiredItems.map((item) => {
                  const daysExpired = getDaysExpired(item.expirationDate!);
                  const isSelected = selectedItems.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30'
                          : 'bg-theme-secondary/50 border-theme hover:bg-theme-secondary'
                      }`}
                      onClick={() => handleSelectItem(item.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Toggle expired item ${item.item}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectItem(item.id);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 text-[var(--accent-color)] bg-theme-primary border-theme rounded focus:ring-[var(--accent-color)]"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-theme-primary truncate">
                            {item.item}
                          </span>
                          <span className="text-sm bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                            {daysExpired} day{daysExpired !== 1 ? 's' : ''} expired
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-theme-secondary">
                          <span>Qty: {getQuantityAmount(item.quantity)}</span>
                          {item.category && <span>• {item.category}</span>}
                          {item.storageLocation && <span>• {item.storageLocation}</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-red-500 font-medium">
                          Expired {new Date(item.expirationDate!).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Disposal Reason */}
              {selectedItems.size > 0 && (
                <div className="mt-6 p-4 bg-theme-secondary/30 rounded-lg border border-theme">
                  <h3 className="text-sm font-semibold text-theme-primary mb-3">What happened to these items?</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="disposal"
                        value="thrown_away"
                        checked={disposalReason === 'thrown_away'}
                        onChange={(e) => setDisposalReason(e.target.value as DisposalReason)}
                        className="w-4 h-4 text-[var(--accent-color)]"
                      />
                      <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'pantry.expired.threwItOut' })}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="disposal"
                        value="cooked"
                        checked={disposalReason === 'cooked'}
                        onChange={(e) => setDisposalReason(e.target.value as DisposalReason)}
                        className="w-4 h-4 text-[var(--accent-color)]"
                      />
                      <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'pantry.expired.cookedWithIt' })}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="disposal"
                        value="remove"
                        checked={disposalReason === 'remove'}
                        onChange={(e) => setDisposalReason(e.target.value as DisposalReason)}
                        className="w-4 h-4 text-[var(--accent-color)]"
                      />
                      <span className="text-sm text-theme-primary">{intl.formatMessage({ id: 'pantry.expired.justRemoveIt' })}</span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-theme flex-shrink-0">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
          >
            Skip for now
          </button>

          <div className="flex gap-3">
            {selectedItems.size > 0 && (
              <button
                onClick={handleRemoveSelected}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpiredItemsModal;