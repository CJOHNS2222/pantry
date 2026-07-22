import { useCallback } from 'react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { LoadingState, User } from '../../types';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { PantryService } from '../../services/pantryService';
import SpoonacularFoodClient from '../../services/spoonacularFoodClient';
import { extractReceiptItems } from '../../services/receiptOcrService';
import { useAppActions } from '../../contexts/AppActionsContext';
import { ReceiptScanResult } from './usePantryScan';

type AppActionsContextValue = ReturnType<typeof useAppActions>;

/**
 * Camera/gallery/barcode/receipt capture + Gemini analysis logic for the
 * pantry "Add Items" flow (PERF-001). Extracted verbatim from PantryScanner.tsx —
 * behavior, including existing useCallback dependency arrays, is preserved
 * exactly; this only relocates the functions and threads their previously
 * closed-over values in as parameters.
 */
export function usePantryScannerScan(
  appActions: AppActionsContextValue,
  user: User | null | undefined,
  rawBase64: string | null,
  mimeType: string,
  setImagePreview: (preview: string | null) => void,
  setRawBase64: (data: string | null) => void,
  setMimeType: (mime: string) => void,
  setLoadingState: (state: LoadingState) => void,
  setImageAnalyzeError: (error: string | null) => void,
  setScanResults: (results: ReceiptScanResult[] | null) => void,
  setShowScanReviewModal: (open: boolean) => void,
  setNewItemText: (text: string) => void,
  setIsAddModalOpen: (open: boolean) => void,
) {
  // Use Capacitor Camera for mobile
  const handleTakePhoto = useCallback(async () => {
    try {
      AnalyticsService.trackFeatureUsage('pantry_scanner', { success: true, itemsScanned: 0, itemsAdded: 0 });

      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 60,
        width: 1280,
        height: 1280,
      });
      setImagePreview(photo.dataUrl || null);
      if (photo.dataUrl) {
        const base64Data = photo.dataUrl.split(',')[1];
        setRawBase64(base64Data);
        setMimeType(photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
      setLoadingState(LoadingState.IDLE);
    } catch (err: unknown) {
      setLoadingState(LoadingState.IDLE);
      const errMsg = err instanceof Error ? err.message : '';
      // Handle camera permission errors
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        // Only show error for non-user-cancellation errors
        appActions.addToast('Failed to access camera. Please try again.', 'error');
      }
      // User cancelled - no toast needed
    }
  }, [appActions]);

  // Select photo from gallery
  const handleSelectFromGallery = useCallback(async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 60,
        width: 1280,
        height: 1280,
      });
      setImagePreview(photo.dataUrl || null);
      if (photo.dataUrl) {
        const base64Data = photo.dataUrl.split(',')[1];
        setRawBase64(base64Data);
        setMimeType(photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      // Handle photo library permission errors
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Photo library permission is required. Please enable photo access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        // Only show error for non-user-cancellation errors
        appActions.addToast('Failed to access photo library. Please try again.', 'error');
      }
      // User cancelled - no toast needed
    }
  }, [appActions]);

  // Barcode scanning with camera
  const handleScanBarcode = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      appActions.addToast('Barcode scanning requires the mobile app. Please use the camera or upload an image instead.', 'info', 6000);
      return;
    }
    try {
      // Track feature adoption
      AnalyticsService.trackFeatureFirstUse('pantry_scanner_barcode', { method: 'barcode' });

      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 80,
        width: 1920,
        height: 1920,
      });

      if (photo.dataUrl) {
        setLoadingState(LoadingState.LOADING);
        setImagePreview(photo.dataUrl);

        // Convert data URL to ImageData for barcode detection
        const img = new window.Image();
        img.onload = async () => {
          try {
            const { BrowserMultiFormatReader } = await import('@zxing/library');
            const codeReader = new BrowserMultiFormatReader();
            const result = await codeReader.decodeFromImage(img);

            if (result) {
              const barcode = result.getText();
              AnalyticsService.trackPantryScan(1, 1);

              // Look up the product name via Spoonacular UPC search
              try {
                const product = await SpoonacularFoodClient.searchGroceryProductByUPC(barcode);
                const p = product as { title?: string; breadcrumbs?: string[] };
                if (product && p.title) {
                  setNewItemText(p.title);
                  // Use the first breadcrumb as a category hint if available
                  if (p.breadcrumbs && p.breadcrumbs.length) {
                    const hint = p.breadcrumbs[p.breadcrumbs.length - 1];
                    // capitalise first letter
                    setNewItemText(p.title);
                    // store breadcrumb in unit field temporarily isn't clean — just pre-fill name
                    // Category inference will run in createManualItem from the product title
                    void hint; // acknowledged, category inferred from title downstream
                  }
                  appActions.addToast(`Found: ${p.title}`, 'success', 3000);
                } else {
                  // Product not found in database — let user edit the raw barcode text
                  setNewItemText(`Scanned Item (${barcode})`);
                  appActions.addToast('Product not found in database. Please edit the name.', 'warning', 4000);
                }
              } catch {
                setNewItemText(`Scanned Item (${barcode})`);
              }

              setIsAddModalOpen(true);
            } else {
              appActions.addToast('No barcode detected. Try taking a clearer photo or use manual entry.', 'error');
            }
          } catch (error) {
            log.error('Barcode detection error', { error });
            appActions.addToast('Barcode detection failed. Try taking a clearer photo or use manual entry.', 'error');
          } finally {
            setLoadingState(LoadingState.IDLE);
          }
        };
        img.src = photo.dataUrl;
      }
    } catch (err: unknown) {
      setLoadingState(LoadingState.IDLE);
      const errMsg = err instanceof Error ? err.message : '';
      // Handle camera permission errors for barcode scanning
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required for barcode scanning. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        // Only show error for non-user-cancellation errors
        appActions.addToast('Failed to access camera for barcode scanning. Please try again.', 'error');
      }
      // User cancelled - no toast needed
    }
  }, [appActions]);

  // Receipt processing chain: Tesseract OCR runs first as a diagnostic pre-step.
  // If OCR extracts text lines, they are logged but cannot currently be passed to the
  // Gemini API (which only accepts base64 image + mimeType). Both branches therefore
  // fall through to PantryService.analyzeReceiptImage (Gemini vision), which parses
  // the image directly. The OCR step is retained for future use: once the API supports
  // text hints, OCR output can significantly reduce Gemini token usage.
  // Error path: if Tesseract fails (WASM load failure, network, etc.), we skip straight
  // to image-only Gemini analysis without surfacing the OCR error to the user.
  const processReceiptImage = useCallback(async (base64Data: string, mimeType: string) => {
    try {
      // Try Tesseract OCR first as a low-cost pre-processing step.
      // If we can extract clean text, pass it through to save Gemini tokens.
      let processedItems;
      try {
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        const ocrLines = await extractReceiptItems(dataUrl);
        if (ocrLines.length > 0) {
          // We got OCR results — pass the extracted text alongside the image to Gemini
          // so it can structure items with category/quantity info
          log.debug('Tesseract OCR extracted lines', { count: ocrLines.length }, 'PantryScanner');
          // Pass OCR hint in the mimeType slot isn't possible; fall back to standard analysis
          // The OCR lines are logged for diagnostics but the API only accepts base64 + mimeType
          processedItems = await PantryService.analyzeReceiptImage(base64Data, mimeType, user ?? undefined);
        } else {
          processedItems = await PantryService.analyzeReceiptImage(base64Data, mimeType, user ?? undefined);
        }
      } catch (ocrErr) {
        // Tesseract failed (network, WASM, etc.) — fall back to image-only Gemini analysis
        log.warn('Tesseract OCR failed, falling back to image-only analysis', { error: String(ocrErr) }, 'PantryScanner');
        processedItems = await PantryService.analyzeReceiptImage(base64Data, mimeType, user ?? undefined);
      }

      // Instead of immediately saving, open a review modal so user can edit/confirm items
      setScanResults(processedItems);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.SUCCESS);

      // Auto-close the modal after showing success message
      setTimeout(() => {
        setImagePreview(null);
        setRawBase64(null);
        setLoadingState(LoadingState.IDLE);
      }, 3000);
    } catch (err) {
      log.error('Receipt analysis failed', { err });
      appActions.addToast(err instanceof Error ? err.message : 'Failed to analyze receipt. Please try again.', 'error');
      setLoadingState(LoadingState.ERROR);
    }
  }, [user]);

  // Receipt scanning with camera
  const handleScanReceipt = useCallback(async () => {
    try {
      // Track feature adoption
      AnalyticsService.trackFeatureFirstUse('pantry_scanner_receipt', { method: 'receipt' });

      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 80,
        width: 1920,
        height: 1920,
      });

      if (photo.dataUrl) {
        setLoadingState(LoadingState.LOADING);
        setImagePreview(photo.dataUrl);
        const base64Data = photo.dataUrl.split(',')[1];
        setRawBase64(base64Data);
        setMimeType(photo.format ? `image/${photo.format}` : 'image/jpeg');

        // Process receipt
        await processReceiptImage(base64Data, photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
    } catch (err: unknown) {
      setLoadingState(LoadingState.IDLE);
      const errMsg = err instanceof Error ? err.message : '';
      // Handle camera permission errors for receipt scanning
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required for receipt scanning. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        // Only show error for non-user-cancellation errors
        appActions.addToast('Failed to access camera for receipt scanning. Please try again.', 'error');
      }
      // User cancelled - no toast needed
    }
  }, [appActions]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: type and size before any processing
    if (!file.type.startsWith('image/')) {
      appActions.addToast('Only image files are supported. Please select a JPEG, PNG, or WebP file.', 'error');
      e.target.value = '';
      return;
    }
    const MAX_FILE_SIZE_MB = 10;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      appActions.addToast(`Image must be under ${MAX_FILE_SIZE_MB} MB. Please choose a smaller file.`, 'error');
      e.target.value = '';
      return;
    }

    setLoadingState(LoadingState.IDLE);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64Data = result.split(',')[1];
      setRawBase64(base64Data);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!rawBase64) return;

    setLoadingState(LoadingState.LOADING);

    log.debug('PantryScanner handleAnalyze starting', {
      imageSizeKB: Math.round(rawBase64.length / 1024),
      mimeType,
      userId: user?.id ?? 'none',
      isGuest: user?.isGuest ?? false,
    }, 'PantryScanner');

    try {
      const processedItems = await PantryService.analyzePantryImage(rawBase64, mimeType, user ?? undefined);

      // Instead of immediately saving, open a review modal so user can edit/confirm items
      setScanResults(processedItems);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.SUCCESS);
      setImageAnalyzeError(null);

      // Auto-close the modal after showing success message
      setTimeout(() => {
        setImagePreview(null);
        setRawBase64(null);
        setLoadingState(LoadingState.IDLE);
      }, 3000);
    } catch (err) {
      log.error('Image analysis failed', { err });
      const msg = err instanceof Error ? err.message : 'Failed to analyze image. Please try again.';
      setImageAnalyzeError(msg);
      appActions.addToast(msg, 'error');
      setLoadingState(LoadingState.ERROR);
    }
  }, [rawBase64, mimeType, user]);

  return {
    handleTakePhoto,
    handleSelectFromGallery,
    handleScanBarcode,
    handleScanReceipt,
    handleFileChange,
    handleAnalyze,
  };
}
