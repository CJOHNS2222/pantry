/**
 * Tesseract receipt OCR service.
 *
 * Lazy-loads the Tesseract.js WASM worker and eng.traineddata only when the
 * user triggers receipt scanning — keeps the baseline APK lean.
 *
 * Usage:
 *   const items = await extractReceiptItems(imageDataUrl);
 *   // items: string[] of raw line text that look like grocery items
 */

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, {
        // Fetch traineddata from CDN so it isn't bundled into the APK
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6/tesseract-core.wasm.js',
        logger: () => {}, // suppress progress logs in production
      });
      return w;
    })();
  }
  return workerPromise;
}

/**
 * Clean up and release the Tesseract worker (call on app unload, optional).
 */
export async function destroyReceiptOcrWorker(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      // ignore
    } finally {
      workerPromise = null;
    }
  }
}

/**
 * Run OCR on a receipt image and return candidate grocery item lines.
 *
 * @param imageSource - data URL, blob URL, or File object of the receipt image
 * @returns An array of raw text lines that match typical grocery item patterns
 */
export async function extractReceiptItems(
  imageSource: string | Blob | File,
): Promise<string[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageSource);

  return parseReceiptText(data.text);
}

/**
 * Parse raw OCR text into a list of likely grocery item names.
 * Filters out price-only lines, totals, tax, store headers, and blank lines.
 */
export function parseReceiptText(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Patterns that indicate non-item lines (totals, payment info, headers, etc.)
  const skipPatterns = [
    /^\*+$/,                           // decorative separators
    /^(subtotal|sub\.?total|total|tax|hst|gst|pst|change|cash|card|visa|mastercard|amex|debit|credit|balance|savings?|you saved|thank you|receipt|store|loyalty|points|reward)/i,
    /^\d{1,2}[/:]\d{2}([/:]\d{2,4})?(\s+\d{1,2}:\d{2})?$/, // dates/times only
    /^#{2,}/,                          // store receipt header chars
    /^[-=]{3,}$/,                      // divider lines
    /^\$?\d+\.\d{2}$/,                 // price-only lines
    /^[0-9\s]+$/,                      // digit-only lines (barcodes etc.)
  ];

  const itemPattern = /^[A-Za-z].*\S/; // must start with a letter

  return lines.filter(line => {
    if (!itemPattern.test(line)) return false;
    if (line.length < 3 || line.length > 60) return false;
    return !skipPatterns.some(re => re.test(line));
  }).map(line => {
    // Strip trailing price (e.g., "Whole Milk 1GAL  2.49 T" → "Whole Milk 1GAL")
    return line.replace(/\s+\d+\.\d{2}\s*[A-Z]?\s*$/, '').trim();
  }).filter(line => line.length >= 3);
}
