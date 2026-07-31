import React, { useEffect, useState } from 'react';
import { Barcode, Plus, Loader2, X } from 'lucide-react';
import { BottomSheet } from '../ui';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { useAppActions } from '../../contexts/AppActionsContext';
import { captureAndDecodeBarcode, BarcodeDecodeError } from '../../utils/barcodeScan';
import SpoonacularFoodClient from '../../services/spoonacularFoodClient';
import { getNutritionFactsWithFallback, NutritionFacts } from '../../services/nutritionService';
import { inferCategoryFromItemName } from '../../utils/appUtils';
import { PantryService } from '../../services/pantryService';
import { PantryItem, ShoppingItem } from '../../types';
import { NutritionFactsCard } from './NutritionFactsCard';
import { log } from '../../services/logService';

interface NutritionScanSlot {
  id: string;
  upc: string;
  productTitle: string;
  nutrition: NutritionFacts | null;
  loading: boolean;
}

interface NutritionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pantry screen usage: adds the scanned product straight to inventory. */
  inventory?: PantryItem[];
  onAddItem?: (item: PantryItem) => Promise<void>;
  /** Shopping List screen usage: adds the scanned product to the shopping list instead. */
  onAddToShoppingList?: (item: Omit<ShoppingItem, 'id'>) => void;
}

const LOWER_IS_BETTER: Array<'calories' | 'sugar' | 'fat'> = ['calories', 'sugar', 'fat'];
const HIGHER_IS_BETTER: Array<'fiber' | 'protein'> = ['fiber', 'protein'];

export const NutritionScannerModal: React.FC<NutritionScannerModalProps> = ({ isOpen, onClose, inventory, onAddItem, onAddToShoppingList }) => {
  useAndroidBack(isOpen, onClose);
  const { addToast } = useAppActions();
  const [slots, setSlots] = useState<NutritionScanSlot[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSlots([]);
      setScanning(false);
    }
  }, [isOpen]);

  const scanProduct = async () => {
    if (slots.length >= 2 || scanning) return;
    setScanning(true);
    try {
      const captured = await captureAndDecodeBarcode();
      if (!captured || !captured.barcode) {
        addToast('No barcode detected. Try taking a clearer photo.', 'error');
        return;
      }

      const barcode = captured.barcode;
      if (slots.some(s => s.upc === barcode)) {
        addToast('That product has already been scanned.', 'error');
        return;
      }

      let productTitle = `Scanned Item (${barcode})`;
      try {
        const product = await SpoonacularFoodClient.searchGroceryProductByUPC(barcode);
        const p = product as { title?: string } | null;
        if (p?.title) productTitle = p.title;
      } catch {
        // Fall back to the raw barcode label
      }

      const scanId = `${barcode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setSlots(prev => [...prev, { id: scanId, upc: barcode, productTitle, nutrition: null, loading: true }]);

      const category = inferCategoryFromItemName(productTitle);
      const nutrition = await getNutritionFactsWithFallback(productTitle, category).catch(() => null);
      setSlots(prev => prev.map(s => (s.id === scanId ? { ...s, nutrition, loading: false } : s)));
    } catch (error) {
      if (error instanceof BarcodeDecodeError) {
        addToast('Barcode detection failed. Try taking a clearer photo.', 'error');
      } else {
        const msg = error instanceof Error ? error.message : '';
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('Permission')) {
          addToast('Camera permission is required to scan barcodes.', 'error');
        } else if (!msg.includes('cancelled') && !msg.includes('dismissed')) {
          addToast('Failed to access camera. Please try again.', 'error');
        }
      }
      log.error('Nutrition scan failed', { error }, 'NutritionScannerModal');
    } finally {
      setScanning(false);
    }
  };

  const canAdd = !!onAddItem || !!onAddToShoppingList;

  const handleAdd = async (slot: NutritionScanSlot) => {
    try {
      if (onAddItem) {
        const item = PantryService.createManualItem(slot.productTitle, 1, inventory ?? [], 'count');
        await onAddItem(item);
        addToast(`Added ${slot.productTitle} to pantry`, 'success');
      } else if (onAddToShoppingList) {
        onAddToShoppingList({
          item: slot.productTitle,
          category: inferCategoryFromItemName(slot.productTitle),
          checked: false,
          quantity: '1',
          source: 'nutrition-scanner',
          addedAt: new Date(),
        });
        addToast(`Added ${slot.productTitle} to shopping list`, 'success');
      }
    } catch (error) {
      log.error('Failed to add scanned item', { error }, 'NutritionScannerModal');
      addToast('Failed to add item', 'error');
    }
  };

  const betterMetricsFor = (index: number): Partial<Record<'calories' | 'sugar' | 'fat' | 'fiber' | 'protein', boolean>> | undefined => {
    if (slots.length < 2) return undefined;
    const mine = slots[index]?.nutrition;
    const other = slots[index === 0 ? 1 : 0]?.nutrition;
    if (!mine || !other) return undefined;

    const result: Partial<Record<'calories' | 'sugar' | 'fat' | 'fiber' | 'protein', boolean>> = {};
    for (const key of LOWER_IS_BETTER) {
      if (mine[key] != null && other[key] != null && mine[key]! < other[key]!) result[key] = true;
    }
    for (const key of HIGHER_IS_BETTER) {
      if (mine[key] != null && other[key] != null && mine[key]! > other[key]!) result[key] = true;
    }
    return result;
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Nutrition Scanner">
      <BottomSheet.Body className="p-4 space-y-4">
        {slots.length === 0 && (
          <p className="text-sm text-theme-secondary">
            Scan a product's barcode to see its nutrition facts. Scan a second product to compare them side by side.
          </p>
        )}

        {slots.length > 0 && (
          <div className={slots.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}>
            {slots.map((slot, index) => (
              <div key={slot.id} className="bg-theme-primary rounded-xl border border-theme p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-theme-primary text-sm">{slot.productTitle}</span>
                  {canAdd && (
                    <button
                      onClick={() => handleAdd(slot)}
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent-color)] text-white rounded-lg hover:opacity-90"
                      aria-label={`Add ${slot.productTitle}${onAddItem ? ' to pantry' : ' to shopping list'}`}
                    >
                      <Plus className="w-3 h-3" />
                      {onAddItem ? 'Add to Pantry' : 'Add to List'}
                    </button>
                  )}
                </div>
                <NutritionFactsCard nutrition={slot.nutrition} loading={slot.loading} betterMetrics={betterMetricsFor(index)} />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {slots.length < 2 && (
            <button
              onClick={scanProduct}
              disabled={scanning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Barcode className="w-4 h-4" />
                  {slots.length === 0 ? 'Scan Product' : 'Scan Another to Compare'}
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-3 bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-primary transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            {slots.length === 0 ? 'Cancel' : 'Done'}
          </button>
        </div>
      </BottomSheet.Body>
    </BottomSheet>
  );
};

export default NutritionScannerModal;
