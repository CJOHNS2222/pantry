import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/** Thrown when a photo was captured successfully but zxing failed to decode a barcode from it — distinct from camera/permission errors so callers can show different messaging. */
export class BarcodeDecodeError extends Error {}

export interface BarcodeCaptureResult {
  /** The decoded barcode string, or null if none was detected. */
  barcode: string | null;
  /** The captured photo as a data URL, useful for a preview thumbnail. */
  dataUrl: string;
}

/**
 * Captures a photo via the native camera and decodes a barcode from it using @zxing/library.
 * Native-only (no live-viewfinder, no web fallback) — matches the existing pantry-scan barcode flow.
 *
 * Throws on camera/permission errors (error message contains 'permission', 'denied', 'cancelled',
 * or 'dismissed') so callers can show their own contextual toast wording.
 *
 * @returns null if the user cancelled before a photo was captured, otherwise the capture result.
 */
export async function captureAndDecodeBarcode(): Promise<BarcodeCaptureResult | null> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Barcode scanning requires the mobile app.');
  }

  const photo = await CapacitorCamera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 80,
    width: 1920,
    height: 1920,
  });

  if (!photo.dataUrl) return null;
  const dataUrl = photo.dataUrl;

  return new Promise<BarcodeCaptureResult>((resolve, reject) => {
    const img = new window.Image();
    img.onload = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const codeReader = new BrowserMultiFormatReader();
        const result = await codeReader.decodeFromImage(img);
        resolve({ barcode: result ? result.getText() : null, dataUrl });
      } catch (error) {
        reject(new BarcodeDecodeError(error instanceof Error ? error.message : 'Barcode decode failed'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load captured photo'));
    img.src = dataUrl;
  });
}
