import React from 'react';
import { PantryItem, User, CustomCategory, ShoppingItem } from '../../types';
import { ReceiptScanResult } from './usePantryScan';
import { getPreferredItemDisplayImage, getAllCategories } from '../../utils/appUtils';
import { groceryPriceService } from '../../services/groceryPriceService';
import { useAppActions } from '../../contexts/AppActionsContext';
import { log } from '../../services/logService';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { Modal } from '../ui/Modal';
import { useIntl } from 'react-intl';

interface ScanReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanResults: ReceiptScanResult[];
  setScanResults: (results: ReceiptScanResult[] | null) => void;
  receiptDestination: 'pantry' | 'shopping';
  setReceiptDestination: (dest: 'pantry' | 'shopping') => void;
  customCategories?: CustomCategory[];
  onAddItems: (items: PantryItem[]) => Promise<void>;
  addShoppingListItem?: (item: Omit<ShoppingItem, 'id'>) => Promise<void> | void;
  user?: User | null;
}

export const ScanReviewModal: React.FC<ScanReviewModalProps> = ({
  isOpen,
  onClose,
  scanResults,
  setScanResults,
  receiptDestination,
  setReceiptDestination,
  customCategories = [],
  onAddItems,
  addShoppingListItem,
  user,
}) => {
  const intl = useIntl();
  const appActions = useAppActions();

  // Close modal when android back button pressed
  useAndroidBack(isOpen, onClose);

  if (!isOpen || !scanResults) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={intl.formatMessage({ id: 'pantry.reviewScannedItems', defaultMessage: 'Review Scanned Items ({count})' }, { count: scanResults.length })}
      size="lg"
      panelClassName="sm:max-w-2xl"
    >
      <Modal.Body className="bg-theme-primary" padding="sm">

        {/* Scrollable Content */}
          {/* Destination Selector */}
          <div role="group" aria-labelledby="destination-selector-label" className="mb-4 p-3 bg-theme-secondary rounded-lg border border-theme">
            <span id="destination-selector-label" className="block text-sm font-medium text-theme-secondary mb-2">
              {intl.formatMessage({ id: 'pantry.addItemsTo', defaultMessage: 'Add items to:' })}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setReceiptDestination('pantry')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  receiptDestination === 'pantry'
                    ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]'
                    : 'bg-theme-primary border border-theme text-theme-secondary hover:bg-theme-secondary'
                }`}
              >
                <span aria-hidden="true">🏠</span> Pantry
              </button>
              <button
                onClick={() => setReceiptDestination('shopping')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  receiptDestination === 'shopping'
                    ? 'bg-[var(--accent-color)] text-[var(--accent-text,white)]'
                    : 'bg-theme-primary border border-theme text-theme-secondary hover:bg-theme-secondary'
                }`}
              >
                <span aria-hidden="true">🛒</span> Shopping List
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-2">
              {receiptDestination === 'pantry'
                ? 'Items will be added to your pantry inventory'
                : 'Items will be added to your shopping list with price comparison options'}
            </p>
          </div>

          <div className="space-y-3">
            {scanResults.map((sItem, idx) => (
              <div key={sItem.id} className="bg-theme-secondary p-3 rounded-lg border border-theme">
                <div className="flex items-start gap-3">
                  <img
                    src={getPreferredItemDisplayImage(sItem.item, sItem.category, sItem.image)}
                    alt={sItem.item}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/placeholder.svg';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      value={sItem.item}
                      aria-label="Item name"
                      onChange={(e) => {
                        const updated = [...scanResults];
                        updated[idx] = { ...updated[idx], item: e.target.value };
                        setScanResults(updated);
                      }}
                      className="w-full px-2 py-1 rounded bg-theme-primary border border-theme text-theme-primary text-sm focus:ring-1 focus:ring-[var(--accent-color)] focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <input
                        type="number"
                        min="0"
                        value={parseInt(sItem.quantity_estimate || '1')}
                        aria-label="Quantity"
                        onChange={(e) => {
                          const updated = [...scanResults];
                          updated[idx] = { ...updated[idx], quantity_estimate: e.target.value };
                          setScanResults(updated);
                        }}
                        className="w-20 px-2 py-1 text-sm rounded bg-theme-primary border border-theme text-theme-primary focus:ring-1 focus:ring-[var(--accent-color)] focus:outline-none"
                        placeholder="Qty"
                      />
                      <select
                        value={sItem.category || 'Uncategorized'}
                        aria-label="Category"
                        onChange={(e) => {
                          const updated = [...scanResults];
                          updated[idx] = { ...updated[idx], category: e.target.value };
                          setScanResults(updated);
                        }}
                        className="px-2 py-1 text-sm rounded bg-theme-primary border border-theme text-theme-primary focus:ring-1 focus:ring-[var(--accent-color)] focus:outline-none"
                      >
                        {getAllCategories(customCategories).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 bg-theme-primary border border-theme rounded px-2">
                        <span className="text-theme-secondary text-sm" aria-hidden="true">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={sItem.estimatedPrice || ''}
                          aria-label="Estimated price in dollars"
                          onChange={(e) => {
                            const updated = [...scanResults];
                            updated[idx] = { ...updated[idx], estimatedPrice: parseFloat(e.target.value) || undefined };
                            setScanResults(updated);
                          }}
                          className="w-16 py-1 text-sm bg-transparent outline-none text-theme-primary focus:outline-none"
                          placeholder="Cost"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      const updated = scanResults.filter((_, i) => i !== idx);
                      setScanResults(updated.length ? updated : null);
                      if (updated.length === 0) onClose();
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    aria-label={`Remove ${sItem.item} from scan results`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>

        {/* Action Buttons - Fixed at bottom */}
        <Modal.Footer className="bg-theme-primary flex gap-2">
          <button
            onClick={async () => {
              if (receiptDestination === 'pantry') {
                await onAddItems(scanResults as PantryItem[]);
                if (user) {
                  for (const item of scanResults) {
                    if (item.estimatedPrice && item.estimatedPrice > 0) {
                      const unit = 'each'; // default for receipt items
                      groceryPriceService.submitPriceUpdate(item.item, item.estimatedPrice, unit, user.id).catch((e) => {
                        log.warn('Failed to log price:', { error: e }, 'ScanReviewModal');
                      });
                    }
                  }
                }
              } else {
                if (!addShoppingListItem) {
                  appActions.addToast('Shopping list integration not available from this view.', 'info');
                  return;
                }

                for (const item of scanResults) {
                  const shoppingItem: Omit<ShoppingItem, 'id'> = {
                    item: item.item,
                    category: item.category,
                    checked: false,
                    quantity: item.quantity_estimate,
                    source: 'receipt_scan',
                    addedAt: new Date(),
                    estimatedPrice: item.estimatedPrice,
                    priceOptions: item.priceOptions || (item.estimatedPrice ? [{
                      amount: 1,
                      unit: 'count',
                      price: item.estimatedPrice
                    }] : undefined)
                  };
                  await addShoppingListItem(shoppingItem);
                }
              }
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--accent-text,white)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors font-medium text-sm"
            aria-label={intl.formatMessage(
              { id: 'pantry.addAllToDestination', defaultMessage: 'Add all scanned items to {destination}' },
              { destination: receiptDestination === 'pantry' ? 'pantry' : 'shopping list' }
            )}
          >
            {intl.formatMessage(
              { id: 'pantry.addAllToDestination', defaultMessage: 'Add All to {destination}' },
              { destination: receiptDestination === 'pantry' ? intl.formatMessage({ id: 'pantry.label', defaultMessage: 'Pantry' }) : intl.formatMessage({ id: 'shoppingList.label', defaultMessage: 'Shopping List' }) }
            )}
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-primary transition-colors text-sm font-medium"
          >
            {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
          </button>
        </Modal.Footer>
      </Modal>
  );
};
