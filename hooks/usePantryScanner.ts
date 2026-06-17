import { useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BrowserMultiFormatReader } from '@zxing/library';
import { log } from '../services/logService';
import { LoadingState, User } from '../types';
import { PantryService } from '../services/pantryService';
import AnalyticsService from '../services/analyticsService';
import SpoonacularFoodClient from '../services/spoonacularFoodClient';
import { extractReceiptItems } from '../services/receiptOcrService';

export interface ReceiptScanResult {
  id: string;
  item: string;
  category: string;
  quantity_estimate: string;
  estimatedPrice?: number;
  priceOptions?: {
    amount: number;
    unit: string;
    price: number;
  }[];
  image?: string;
  confidence?: string | number;
}

export function usePantryScanner(
  user: User | null | undefined,
  appActions: any,
  setNewItemText: (text: string) => void,
  setIsAddModalOpen: (open: boolean) => void
) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [imageAnalyzeError, setImageAnalyzeError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ReceiptScanResult[] | null>(null);
  const [showScanReviewModal, setShowScanReviewModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        appActions.addToast('Failed to access camera. Please try again.', 'error');
      }
    }
  }, [appActions]);

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
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Photo library permission is required. Please enable photo access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        appActions.addToast('Failed to access photo library. Please try again.', 'error');
      }
    }
  }, [appActions]);

  const handleScanBarcode = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      appActions.addToast('Barcode scanning requires the mobile app. Please use the camera or upload an image instead.', 'info', 6000);
      return;
    }
    try {
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
        
        const img = new window.Image();
        img.onload = async () => {
          try {
            const codeReader = new BrowserMultiFormatReader();
            const result = await codeReader.decodeFromImage(img);
            
            if (result) {
              const barcode = result.getText();
              AnalyticsService.trackPantryScan(1, 1);

              try {
                const product = await SpoonacularFoodClient.searchGroceryProductByUPC(barcode);
                const p = product as { title?: string; breadcrumbs?: string[] };
                if (product && p.title) {
                  setNewItemText(p.title);
                  appActions.addToast(`Found: ${p.title}`, 'success', 3000);
                } else {
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
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required for barcode scanning. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        appActions.addToast('Failed to access camera for barcode scanning. Please try again.', 'error');
      }
    }
  }, [appActions, setNewItemText, setIsAddModalOpen]);

  const processReceiptImage = useCallback(async (base64Data: string, mime: string) => {
    try {
      let processedItems;
      try {
        const dataUrl = `data:${mime};base64,${base64Data}`;
        const ocrLines = await extractReceiptItems(dataUrl);
        if (ocrLines.length > 0) {
          log.debug('Tesseract OCR extracted lines', { count: ocrLines.length }, 'PantryScanner');
          processedItems = await PantryService.analyzeReceiptImage(base64Data, mime, user ?? undefined);
        } else {
          processedItems = await PantryService.analyzeReceiptImage(base64Data, mime, user ?? undefined);
        }
      } catch (ocrErr) {
        log.warn('Tesseract OCR failed, falling back to image-only analysis', { error: String(ocrErr) }, 'PantryScanner');
        processedItems = await PantryService.analyzeReceiptImage(base64Data, mime, user ?? undefined);
      }

      setScanResults(processedItems);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.SUCCESS);

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
  }, [user, appActions]);

  const handleScanReceipt = useCallback(async () => {
    try {
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
        
        await processReceiptImage(base64Data, photo.format ? `image/${photo.format}` : 'image/jpeg');
      }
    } catch (err: unknown) {
      setLoadingState(LoadingState.IDLE);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('Permission')) {
        appActions.addToast(
          'Camera permission is required for receipt scanning. Please enable camera access in your device settings and try again.',
          'error',
          8000
        );
      } else if (!errMsg.includes('cancelled') && !errMsg.includes('dismissed')) {
        appActions.addToast('Failed to access camera for receipt scanning. Please try again.', 'error');
      }
    }
  }, [appActions, processReceiptImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
  }, [appActions]);

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

      setScanResults(processedItems as ReceiptScanResult[]);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.SUCCESS);
      setImageAnalyzeError(null);

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
  }, [rawBase64, mimeType, user, appActions]);

  const resetScanner = useCallback(() => {
    setImagePreview(null);
    setRawBase64(null);
    setMimeType("");
    setLoadingState(LoadingState.IDLE);
    setImageAnalyzeError(null);
    setScanResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
    imagePreview, setImagePreview,
    rawBase64, setRawBase64,
    mimeType, setMimeType,
    loadingState, setLoadingState,
    imageAnalyzeError, setImageAnalyzeError,
    scanResults, setScanResults,
    showScanReviewModal, setShowScanReviewModal,
    fileInputRef,
    handleTakePhoto,
    handleSelectFromGallery,
    handleScanBarcode,
    handleScanReceipt,
    handleFileChange,
    handleAnalyze,
    processReceiptImage,
    resetScanner
  };
}
