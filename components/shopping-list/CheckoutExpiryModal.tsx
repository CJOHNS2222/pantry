import React, { useState, useEffect } from 'react';
import { Calendar, Sparkles, X, Check } from 'lucide-react';
import { ShoppingItem } from '../../types';

interface CheckoutExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ShoppingItem[];
  onConfirm: (updatedItems: ShoppingItem[]) => void;
}

export const CheckoutExpiryModal: React.FC<CheckoutExpiryModalProps> = ({
  isOpen,
  onClose,
  items,
  onConfirm,
}) => {
  const [expirySettings, setExpirySettings] = useState<Record<string, { mode: string; date?: string }>>({});

  // Initialize expiry settings when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, { mode: string; date?: string }> = {};
      items.forEach(item => {
        initial[item.id] = { mode: '1w' }; // Default to 1 week
      });
      setExpirySettings(initial);
    }
  }, [isOpen, items]);

  if (!isOpen || items.length === 0) return null;

  const getComputedDate = (mode: string, customDate?: string): string | undefined => {
    if (mode === 'stable') return undefined; // No expiry / Shelf stable
    const d = new Date();
    if (mode === '3d') {
      d.setDate(d.getDate() + 3);
    } else if (mode === '1w') {
      d.setDate(d.getDate() + 7);
    } else if (mode === '2w') {
      d.setDate(d.getDate() + 14);
    } else if (mode === '1m') {
      d.setMonth(d.getMonth() + 1);
    } else if (mode === 'custom') {
      return customDate;
    }
    return d.toISOString().slice(0, 10);
  };

  const handleSetAll = (mode: string) => {
    const updated = { ...expirySettings };
    items.forEach(item => {
      updated[item.id] = { ...updated[item.id], mode };
    });
    setExpirySettings(updated);
  };

  const handleItemModeChange = (id: string, mode: string) => {
    setExpirySettings(prev => ({
      ...prev,
      [id]: { ...prev[id], mode }
    }));
  };

  const handleCustomDateChange = (id: string, date: string) => {
    setExpirySettings(prev => ({
      ...prev,
      [id]: { ...prev[id], mode: 'custom', date }
    }));
  };

  const handleConfirm = () => {
    const updated = items.map(item => {
      const setting = expirySettings[item.id] || { mode: '1w' };
      const expires = getComputedDate(setting.mode, setting.date);
      const isImmortal = setting.mode === 'stable';

      const neededQty = item.quantity ? parseFloat(item.quantity as string) : 1;
      const amount = isNaN(neededQty) ? 1 : neededQty;
      const unit = typeof item.quantity === 'string' ? item.quantity.replace(/^[\d\/\s\.\-]+/, '').trim() || 'count' : 'count';

      return {
        ...item,
        purchasedQuantity: { amount, unit },
        purchasedBatch: {
          amount,
          unit,
          expires,
          is_immortal: isImmortal
        }
      };
    });

    onConfirm(updated);
  };

  const chips = [
    { label: '3 Days', value: '3d' },
    { label: '1 Week', value: '1w' },
    { label: '2 Weeks', value: '2w' },
    { label: '1 Month', value: '1m' },
    { label: 'Shelf Stable', value: 'stable' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-theme-secondary w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[90dvh] overflow-hidden border border-theme"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-theme flex items-center justify-between bg-theme-primary/30">
          <div>
            <h3 className="text-lg font-bold text-theme-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--accent-color)]" />
              Quick Expiration Setup
            </h3>
            <p className="text-xs text-theme-secondary mt-0.5">Set shelf life for checked items before moving to pantry</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-theme-primary/60 transition-colors text-theme-secondary hover:text-theme-primary"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="bg-theme-primary/50 px-5 py-3 border-b border-theme">
          <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider block mb-2">Set all items to:</span>
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button
                key={chip.value}
                onClick={() => handleSetAll(chip.value)}
                className="text-xs px-3 py-1.5 rounded-lg bg-theme-secondary hover:bg-theme border border-theme text-theme-primary hover:border-[var(--accent-color)]/50 transition-colors font-medium"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 divide-y divide-theme/40 max-h-[50dvh]">
          {items.map((item, _idx) => {
            const setting = expirySettings[item.id] || { mode: '1w' };
            return (
              <div key={item.id} className="pt-4 first:pt-0 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-theme-primary text-sm sm:text-base truncate max-w-[280px]">
                    {item.item}
                  </span>
                  <span className="text-xs bg-theme-primary border border-theme px-2 py-0.5 rounded-full text-theme-secondary">
                    Needed: {item.quantity || '1'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  {chips.map(chip => (
                    <button
                      key={chip.value}
                      onClick={() => handleItemModeChange(item.id, chip.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                        setting.mode === chip.value
                          ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] font-semibold shadow-sm'
                          : 'bg-theme-primary/40 text-theme-secondary border-theme hover:border-[var(--accent-color)]/30'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}

                  {/* Custom Picker Trigger */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => handleItemModeChange(item.id, 'custom')}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                        setting.mode === 'custom'
                          ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] font-semibold shadow-sm'
                          : 'bg-theme-primary/40 text-theme-secondary border-theme hover:border-[var(--accent-color)]/30'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Custom
                    </button>

                    {setting.mode === 'custom' && (
                      <input
                        type="date"
                        value={setting.date || ''}
                        onChange={(e) => handleCustomDateChange(item.id, e.target.value)}
                        className="ml-2 px-2 py-1 text-xs bg-theme-primary border border-theme rounded text-theme-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-theme bg-theme-primary/30 flex items-center justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-theme-primary border border-theme text-theme-secondary hover:bg-theme hover:text-theme-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 text-sm font-bold rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/95 text-white transition-colors flex items-center gap-1.5 shadow-md hover:shadow-lg"
          >
            <Check className="w-4 h-4" />
            Confirm Checkout
          </button>
        </div>
      </div>
    </div>
  );
};
