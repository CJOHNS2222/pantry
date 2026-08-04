import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Camera, Image, Barcode, Receipt, Loader2, CheckCircle2, Plus, FilePlus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { PantryItem, LoadingState, User } from '../../types';
import { usePantryScan, ReceiptScanResult } from './usePantryScan';
import { usePantryScannerScan } from './usePantryScannerScan';
import { CameraPermissionsModals } from './modals/CameraPermissionsModals';
import QuantityUnitPicker, { getSmartUnits } from './QuantityUnitPicker';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { setUserGeminiOptIn } from '../../services/featureFlags';
import { log } from '../../services/logService';
import { PantryService } from '../../services/pantryService';
import NutritionScannerModal from './NutritionScannerModal';
import { Modal } from '../ui/Modal';
import { useIntl } from 'react-intl';

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: PantryItem) => Promise<void>;
  inventory: PantryItem[];
  user?: User | null;
  initialAction?: 'photo' | 'barcode' | 'receipt' | 'nutrition' | null;
  onOpenImport: () => void;
  onScanResultsReady: (results: ReceiptScanResult[]) => void;
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  inventory,
  user,
  initialAction = null,
  onOpenImport,
  onScanResultsReady,
}) => {
  const intl = useIntl();
  const appActions = useAppActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for scan & manual add
  const [newItemText, setNewItemText] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newUnit, setNewUnit] = useState('count');

  // Local camera/permission states
  const [showPermissionEducator, setShowPermissionEducator] = useState(false);
  const [showSettingsFallback, setShowSettingsFallback] = useState(false);
  const [pendingCameraAction, setPendingCameraAction] = useState<(() => Promise<void>) | null>(null);
  const [showNutritionScanner, setShowNutritionScanner] = useState(false);

  useAndroidBack(showPermissionEducator, () => {
    setShowPermissionEducator(false);
    setPendingCameraAction(null);
  });
  useAndroidBack(showSettingsFallback, () => {
    setShowSettingsFallback(false);
    setPendingCameraAction(null);
  });
  useAndroidBack(isOpen, onClose);

  const executeCameraActionWithPermissionCheck = useCallback(async (action: () => Promise<void>, type: 'camera' | 'photos' = 'camera') => {
    if (!Capacitor.isNativePlatform()) {
      await action();
      return;
    }

    try {
      const status = await CapacitorCamera.checkPermissions();
      const permissionState = type === 'camera' ? status.camera : status.photos;
      
      if (permissionState === 'granted') {
        await action();
      } else if (permissionState === 'denied') {
        setPendingCameraAction(() => action);
        setShowSettingsFallback(true);
      } else {
        setPendingCameraAction(() => action);
        setShowPermissionEducator(true);
      }
    } catch (err) {
      log.error('Failed to check camera permissions', { err }, 'AddItemsModal');
      await action();
    }
  }, []);

  const {
    imagePreview,
    setImagePreview,
    rawBase64,
    setRawBase64,
    mimeType,
    setMimeType,
    loadingState,
    imageAnalyzeError,
    setImageAnalyzeError,
    setLoadingState
  } = usePantryScan(appActions.addToast);

  const {
    handleTakePhoto,
    handleSelectFromGallery,
    handleScanBarcode,
    handleScanReceipt,
    handleFileChange,
    handleAnalyze,
  } = usePantryScannerScan(
    appActions,
    user,
    rawBase64,
    mimeType,
    setImagePreview,
    setRawBase64,
    setMimeType,
    setLoadingState,
    setImageAnalyzeError,
    // When scanner finishes, send results to parent and close this modal
    (results) => {
      if (results) {
        onScanResultsReady(results);
        onClose();
      }
    },
    // We handle showing review modal in parent
    () => {},
    setNewItemText,
    () => {}, // setOpenModal handled by parent
  );

  // Handle initial action on mount
  useEffect(() => {
    if (!isOpen) return;

    if (initialAction === 'photo') {
      void executeCameraActionWithPermissionCheck(handleTakePhoto);
    } else if (initialAction === 'barcode') {
      void executeCameraActionWithPermissionCheck(handleScanBarcode);
    } else if (initialAction === 'receipt') {
      void executeCameraActionWithPermissionCheck(handleScanReceipt);
    } else if (initialAction === 'nutrition') {
      void executeCameraActionWithPermissionCheck(async () => { setShowNutritionScanner(true); });
    }
  }, [isOpen, initialAction]);

  // Auto-suggest unit based on item name
  useEffect(() => {
    if (newItemText) {
      const smartUnits = getSmartUnits(newItemText);
      if (smartUnits && smartUnits.length > 0) {
        setNewUnit(smartUnits[0]);
      }
    } else {
      setNewUnit('count');
    }
  }, [newItemText]);

  const handleManualAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    try {
      const newItem = PantryService.createManualItem(newItemText, newQty, inventory, newUnit);
      await onAddItem(newItem);
      setNewItemText('');
      setNewQty(1);
      setNewUnit('count');
      onClose();
    } catch (err) {
      appActions.addToast(err instanceof Error ? err.message : 'Failed to add item. Please try again.', 'error');
    }
  }, [newItemText, newQty, newUnit, inventory, onAddItem, onClose, appActions]);

  // Keyboard navigation support for manual entry
  useKeyboardNavigation({
    onEscape: onClose,
    enabled: isOpen && !showPermissionEducator && !showSettingsFallback && !showNutritionScanner
  });

  if (!isOpen) return null;

  const IMAGE_ANALYSIS_STAGES = [
    { label: 'Uploading image...', duration: 2000 },
    { label: 'Scanning for items...', duration: 5000 },
    { label: 'Categorizing ingredients...', duration: 5000 },
    { label: 'Estimating shelf life...', duration: 3000 }
  ];

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={intl.formatMessage({ id: 'pantry.addItems', defaultMessage: 'Add Items' })}
      size="md"
    >
      <Modal.Body className="bg-theme-primary" padding="sm">

        {/* Scrollable Content */}
          {/* Camera/File Upload Section */}
          <div className="bg-theme-secondary p-4 rounded-2xl border border-theme shadow-lg mb-6">
            <button 
              type="button"
              className="w-full relative group cursor-pointer transition-all duration-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  await executeCameraActionWithPermissionCheck(handleTakePhoto);
                } else {
                  fileInputRef.current?.click();
                }
              }}
            >
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] ring-2 ring-[var(--accent-color)]">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                  <GeminiLoadingOverlay
                    isActive={loadingState === LoadingState.LOADING}
                    totalSeconds={60}
                    stages={IMAGE_ANALYSIS_STAGES}
                    variant="overlay"
                    onTimeout={() => {
                      setLoadingState(LoadingState.ERROR);
                      setImageAnalyzeError('Image analysis timed out. Please try again with a clearer photo.');
                      appActions.addToast('Image analysis timed out. Please try again.', 'error');
                    }}
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-theme rounded-xl bg-theme-primary hover:bg-[var(--accent-color)]/5 transition-all aspect-[4/3] flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-theme-secondary rounded-full shadow-lg group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-[var(--accent-color)]" />
                  </div>
                  <div className="text-center">
                    <p className="text-theme-muted text-sm font-medium">Scan receipt or pantry</p>
                    <p className="text-theme-muted text-xs mt-1">Tap to take photo, choose from gallery, or upload image</p>
                  </div>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                data-testid="pantry-file-input"
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
            </button>

            {/* Action Buttons — Row 1: image capture */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) {
                    await executeCameraActionWithPermissionCheck(handleTakePhoto);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                data-testid="pantry-photo-button"
                className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                aria-label="Take photo with camera to scan pantry items"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Photo
              </button>
              
              <button
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) {
                    await executeCameraActionWithPermissionCheck(handleSelectFromGallery, 'photos');
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                data-testid="pantry-gallery-button"
                className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                aria-label="Select photo from gallery to scan pantry items"
              >
                <Image className="w-4 h-4" aria-hidden="true" />
                Gallery
              </button>
              
              {Capacitor.isNativePlatform() && (
                <button
                  onClick={() => executeCameraActionWithPermissionCheck(handleScanBarcode)}
                  data-testid="pantry-barcode-button"
                  disabled={loadingState === LoadingState.LOADING}
                  className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Scan barcode to identify product"
                  aria-disabled={loadingState === LoadingState.LOADING}
                >
                  <Barcode className="w-4 h-4" aria-hidden="true" />
                  Barcode
                </button>
              )}
            </div>

            {/* Action Buttons — Row 2: receipt & import */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => executeCameraActionWithPermissionCheck(handleScanReceipt)}
                data-testid="pantry-receipt-button"
                disabled={loadingState === LoadingState.LOADING}
                className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Scan receipt to add grocery items"
                aria-disabled={loadingState === LoadingState.LOADING}
              >
                <Receipt className="w-4 h-4" aria-hidden="true" />
                Scan Receipt
              </button>
              
              <button
                onClick={onOpenImport}
                data-testid="pantry-import-button"
                className={`flex-1 py-2 px-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 ${
                  inventory.length === 0
                    ? 'border-[var(--accent-color)]/40 bg-[var(--accent-color)]/5 text-[var(--accent-color)] font-semibold hover:bg-[var(--accent-color)]/10'
                    : 'border-theme text-theme-secondary hover:bg-theme-primary'
                }`}
                aria-label="Import pantry items from CSV file or from a recipe URL"
              >
                <FilePlus className="w-4 h-4" aria-hidden="true" />
                Import{inventory.length === 0 ? ' your pantry' : ' / URL'}
              </button>

              {Capacitor.isNativePlatform() && (
                <button
                  onClick={() => executeCameraActionWithPermissionCheck(async () => { setShowNutritionScanner(true); })}
                  data-testid="pantry-nutrition-scanner-button"
                  className="flex-1 py-2 px-3 rounded-lg border border-theme text-theme-secondary hover:bg-theme-primary transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                  aria-label="Scan a product barcode to check nutrition facts"
                >
                  <Barcode className="w-4 h-4" aria-hidden="true" />
                  Nutrition
                </button>
              )}
            </div>

            {imagePreview && loadingState !== LoadingState.SUCCESS && (
              <button
                onClick={handleAnalyze}
                data-testid="pantry-process-image-button"
                disabled={loadingState === LoadingState.LOADING}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--accent-text,white)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Process image with AI to identify pantry items"
                aria-disabled={loadingState === LoadingState.LOADING}
              >
                {loadingState === LoadingState.LOADING ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
                    <span>Analyzing Image...</span>
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4" aria-hidden="true" />
                    <span>Process Image</span>
                  </>
                )}
              </button>
            )}

            {/* Success State */}
            {loadingState === LoadingState.SUCCESS && (
              <div className="w-full mt-4 py-4 rounded-lg bg-green-50 border border-green-200 flex items-center justify-between px-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 animate-bounce" />
                  <div>
                    <p className="text-green-800 font-semibold">Items Added Successfully!</p>
                    <p className="text-green-600 text-sm">Closing automatically...</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setImagePreview(null);
                    setRawBase64(null);
                    setLoadingState(LoadingState.IDLE);
                  }}
                  className="text-green-600 hover:text-green-800 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Error State */}
            {loadingState === LoadingState.ERROR && (
              <div className="w-full mt-4 py-3 px-4 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center gap-2 text-center">
                {imageAnalyzeError?.includes('opt-in required') ? (
                  <>
                    <span className="text-red-800 text-sm">AI scanning requires your permission.</span>
                    <button
                      onClick={() => {
                        if (user) void setUserGeminiOptIn(user.id, true);
                        setImageAnalyzeError(null);
                        setLoadingState(LoadingState.IDLE);
                        void handleAnalyze();
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ✨ Enable AI &amp; Scan
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-left">
                    <X className="w-5 h-5 text-red-600 shrink-0" />
                    <span className="text-red-800 text-sm">{imageAnalyzeError || 'Failed to analyze image. Please try again.'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual Add Section */}
          <div className="bg-theme-secondary p-4 rounded-2xl border border-theme shadow-lg">
            <h4 className="text-lg font-semibold text-theme-secondary mb-4">
              {intl.formatMessage({ id: 'pantry.quickAdd', defaultMessage: 'Quick Add' })}
            </h4>
            <form id="manual-add-form" onSubmit={handleManualAddSubmit} className="space-y-4" role="form" aria-label="Add item manually">
              <div className="space-y-3">
                <input 
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Enter item name..."
                  className="w-full bg-theme-primary border border-theme rounded-lg px-4 py-3 text-theme-secondary shadow-sm outline-none focus:border-[var(--accent-color)] focus:ring-2 focus:ring-[var(--accent-color)]/20 text-sm"
                  aria-label="Item name"
                  aria-required="true"
                  minLength={2}
                  maxLength={50}
                />
                <QuantityUnitPicker
                  quantity={newQty}
                  unit={newUnit}
                  onQuantityChange={setNewQty}
                  onUnitChange={setNewUnit}
                  itemName={newItemText}
                  showControls={true}
                  maxQuantity={999}
                />
              </div>
            </form>
          </div>
        </Modal.Body>

        {/* Action Buttons - Fixed at bottom */}
        <Modal.Footer className="bg-theme-primary">
          <button
            type="submit"
            form="manual-add-form"
            disabled={!newItemText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--accent-text,white)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            aria-label="Add item to pantry"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Item to Pantry
          </button>
        </Modal.Footer>
      </Modal>

      <CameraPermissionsModals
        showPermissionEducator={showPermissionEducator}
        setShowPermissionEducator={setShowPermissionEducator}
        showSettingsFallback={showSettingsFallback}
        setShowSettingsFallback={setShowSettingsFallback}
        pendingCameraAction={pendingCameraAction}
        setPendingCameraAction={setPendingCameraAction}
        setIsAddModalOpen={() => {}}
        onPermissionError={(message) => appActions.addToast(message, 'error')}
      />

      {showNutritionScanner && (
        <NutritionScannerModal
          isOpen={showNutritionScanner}
          onClose={() => setShowNutritionScanner(false)}
        />
      )}
    </>
  );
};

// Inline Gemini Loading Overlay since we need it in AddItemsModal
interface GeminiLoadingOverlayProps {
  isActive: boolean;
  totalSeconds: number;
  stages: { label: string; duration: number }[];
  variant: 'overlay' | 'inline';
  onTimeout?: () => void;
}

const GeminiLoadingOverlay: React.FC<GeminiLoadingOverlayProps> = ({
  isActive,
  totalSeconds,
  stages,
  onTimeout
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setCurrentStage(0);
      setProgress(0);
      return;
    }

    const interval = 100;
    const step = (interval / (totalSeconds * 1000)) * 100;
    
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          onTimeout?.();
          return 100;
        }
        return prev + step;
      });
    }, interval);

    // Progress stages
    let currentDuration = 0;
    const stageTimers = stages.map((stage, idx) => {
      currentDuration += stage.duration;
      return setTimeout(() => {
        setCurrentStage(idx + 1 < stages.length ? idx + 1 : stages.length - 1);
      }, currentDuration);
    });

    return () => {
      clearInterval(progressTimer);
      stageTimers.forEach(clearTimeout);
    };
  }, [isActive, totalSeconds, stages, onTimeout]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-white z-50">
      <div className="w-16 h-16 relative mb-4">
        <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
        <div 
          className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
        ></div>
        <div className="absolute inset-2 bg-black/40 rounded-full flex items-center justify-center font-bold text-xs text-purple-300">
          {Math.round(progress)}%
        </div>
      </div>
      
      <p className="font-bold text-sm text-center mb-1 text-purple-200 animate-pulse">
        {stages[currentStage]?.label || 'Processing...'}
      </p>
      <p className="text-[10px] text-white/50 text-center max-w-[200px] leading-normal">
        Antigravity Gemini AI is analyzing your image to extract item details
      </p>
    </div>
  );
};
