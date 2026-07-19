import { useState, useCallback } from 'react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { extractReceiptItems } from '../../services/receiptOcrService';
import { LoadingState } from '../../types';
import { log } from '../../services/logService';

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
}

export function usePantryScan(
  addToast?: (message: string, type?: 'error' | 'info' | 'success') => void
) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [imageAnalyzeError, setImageAnalyzeError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ReceiptScanResult[] | null>(null);
  const [showScanReviewModal, setShowScanReviewModal] = useState<boolean>(false);
  const [receiptDestination, setReceiptDestination] = useState<'pantry' | 'shopping'>('pantry');

  const capturePhoto = useCallback(async (source: CameraSource = CameraSource.Camera) => {
    try {
      setLoadingState(LoadingState.LOADING);
      setImageAnalyzeError(null);

      const image = await CapacitorCamera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source
      });

      if (!image.base64String) {
        throw new Error('No image data returned from camera');
      }

      const format = image.format ? image.format.toLowerCase() : 'jpeg';
      const calculatedMimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';

      setMimeType(calculatedMimeType);
      setRawBase64(image.base64String);
      setImagePreview(`data:${calculatedMimeType};base64,${image.base64String}`);
      setLoadingState(LoadingState.IDLE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setLoadingState(LoadingState.IDLE);
      if (err?.message !== 'User cancelled photos app' && err?.message !== 'User cancelled camera app') {
        log.error('Camera capture failed', { error: err });
        setImageAnalyzeError('Failed to capture photo. Please try again.');
        addToast?.('Failed to capture photo.', 'error');
      }
    }
  }, [addToast]);

  const analyzeReceipt = useCallback(async (base64Data: string, mime: string) => {
    try {
      setLoadingState(LoadingState.LOADING);
      setImageAnalyzeError(null);

      const imageSource = base64Data.startsWith('data:') ? base64Data : `data:${mime || 'image/jpeg'};base64,${base64Data}`;
      const itemLines = await extractReceiptItems(imageSource);

      if (!itemLines || itemLines.length === 0) {
        setImageAnalyzeError('No items detected on receipt. Try taking a clearer photo.');
        setLoadingState(LoadingState.IDLE);
        return;
      }

      const formattedResults: ReceiptScanResult[] = itemLines.map((lineText, idx) => ({
        id: `scan-${Date.now()}-${idx}`,
        item: lineText || 'Scanned Item',
        category: 'Pantry',
        quantity_estimate: '1 count'
      }));

      setScanResults(formattedResults);
      setShowScanReviewModal(true);
      setLoadingState(LoadingState.IDLE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      log.error('Receipt analysis failed', { error: err });
      setLoadingState(LoadingState.IDLE);
      setImageAnalyzeError(err?.message || 'Failed to analyze receipt.');
      addToast?.('Failed to analyze receipt.', 'error');
    }
  }, [addToast]);

  const resetScan = useCallback(() => {
    setImagePreview(null);
    setRawBase64(null);
    setMimeType('');
    setImageAnalyzeError(null);
    setScanResults(null);
    setShowScanReviewModal(false);
    setLoadingState(LoadingState.IDLE);
  }, []);

  return {
    imagePreview,
    setImagePreview,
    rawBase64,
    setRawBase64,
    mimeType,
    setMimeType,
    loadingState,
    imageAnalyzeError,
    setImageAnalyzeError,
    scanResults,
    showScanReviewModal,
    receiptDestination,
    setReceiptDestination,
    setShowScanReviewModal,
    setScanResults,
    setLoadingState,
    capturePhoto,
    analyzeReceipt,
    resetScan
  };
}
