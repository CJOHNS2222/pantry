import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { PantryItem } from '../types';
import { getQuantityAmount } from '../utils/quantityUtils';
import { getItemImage } from '../utils/appUtils';
import HapticService from '../services/hapticService';
import AnalyticsService from '../services/analyticsService';
import { log } from '../services/logService';
import { useModalOpen } from '../utils/useModalOpen';

const LAUNCH_PREF_KEY = 'pantry_expired_launch_enabled';

export function getExpiredLaunchEnabled(): boolean {
  try {
    const stored = localStorage.getItem(LAUNCH_PREF_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function setExpiredLaunchEnabled(value: boolean) {
  try {
    localStorage.setItem(LAUNCH_PREF_KEY, String(value));
  } catch {
    // ignore
  }
}

interface ExpiredItemsLaunchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  expiredItems: PantryItem[];
  onRemoveItems: (itemIds: string[]) => Promise<void>;
}

const ExpiredItemsLaunchSheet: React.FC<ExpiredItemsLaunchSheetProps> = ({
  isOpen,
  onClose,
  expiredItems,
  onRemoveItems,
}) => {
  useModalOpen(isOpen);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [alwaysShow, setAlwaysShow] = useState(getExpiredLaunchEnabled);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Pre-select all expired items when sheet opens
  useEffect(() => {
    if (isOpen && expiredItems.length > 0) {
      setSelectedItems(new Set(expiredItems.map(i => i.id)));
      AnalyticsService.trackEvent('expired_launch_sheet_opened', {
        expired_count: expiredItems.length,
      });
    }
  }, [isOpen, expiredItems]);

  const getDaysExpired = (expirationDate: string): number => {
    const diffMs = Date.now() - new Date(expirationDate).getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    HapticService.light();
  };

  const handleAlwaysShowToggle = (value: boolean) => {
    setAlwaysShow(value);
    setExpiredLaunchEnabled(value);
  };

  const handleFinish = async () => {
    if (selectedItems.size === 0) {
      onClose();
      return;
    }
    setIsProcessing(true);
    try {
      await onRemoveItems(Array.from(selectedItems));
      AnalyticsService.trackEvent('expired_launch_sheet_removed', {
        count: selectedItems.size,
      });
      HapticService.success();
      onClose();
    } catch (err) {
      log.error('Failed to remove expired items from launch sheet:', err);
      HapticService.error();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    AnalyticsService.trackEvent('expired_launch_sheet_cancelled', {
      expired_count: expiredItems.length,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Expired Items"
        className="relative bg-theme-primary rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-theme-secondary opacity-40" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-lg font-bold text-theme-primary">Expired Items</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-theme-secondary transition-colors"
            aria-label="Close"
          >
            <ChevronDown className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <p className="text-sm text-theme-secondary">
            {expiredItems.length === 1
              ? '1 item in your pantry has expired. Review and remove it to keep your inventory accurate.'
              : `${expiredItems.length} items in your pantry have expired. Review and remove them to keep your inventory accurate.`}
          </p>
        </div>

        {/* Always show toggle */}
        <div className="px-5 pb-3 flex-shrink-0">
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-sm text-theme-secondary">Always display list of expired items on launch</span>
            <button
              role="switch"
              aria-checked={alwaysShow}
              onClick={() => handleAlwaysShowToggle(!alwaysShow)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                alwaysShow ? 'bg-[var(--accent-color)]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  alwaysShow ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
          {expiredItems.map(item => {
            const daysExpired = getDaysExpired(item.expirationDate!);
            const isSelected = selectedItems.has(item.id);
            const imgSrc = getItemImage(item.item, item.category ?? '');

            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[var(--accent-color)]/50 bg-[var(--accent-color)]/5'
                    : 'border-theme bg-theme-secondary/30 hover:bg-theme-secondary/60'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-theme-secondary/50 flex-shrink-0 overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={item.item}
                    className="w-full h-full object-contain p-1"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Name + expiry badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-theme-primary text-sm truncate">{item.item}</span>
                    <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                      {daysExpired}d expired
                    </span>
                  </div>
                  <div className="text-xs text-theme-secondary mt-0.5">
                    Qty: {getQuantityAmount(item.quantity)}
                    {item.category ? ` · ${item.category}` : ''}
                  </div>
                </div>

                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                      : 'border-gray-300 dark:border-gray-600 bg-transparent'
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-t border-theme flex-shrink-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl border border-theme text-theme-secondary hover:bg-theme-secondary/50 transition-colors text-sm font-medium"
          >
            CANCEL
          </button>
          <button
            onClick={handleFinish}
            disabled={isProcessing}
            className="flex-1 py-2.5 rounded-xl bg-[var(--accent-color)] hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Removing…
              </span>
            ) : selectedItems.size > 0 ? (
              `FINISH (Remove ${selectedItems.size})`
            ) : (
              'FINISH'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiredItemsLaunchSheet;
