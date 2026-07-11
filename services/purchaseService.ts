/**
 * purchaseService.ts
 * Wraps cordova-plugin-purchase v13 (CdvPurchase) for Google Play Billing.
 *
 * Flow:
 *  1. Call initializePurchaseStore(userId) once when the app is ready (Android only).
 *  2. Call purchaseProduct(productId) to start the billing flow.
 *  3. The plugin calls our `verifyPurchase` Cloud Function automatically.
 *  4. On success, the CF writes the subscription to Firestore; useSubscription picks it up.
 *  5. Call restorePurchases() to re-verify existing subscriptions.
 *
 * Play Console setup required:
 *  - Create subscription products with IDs: 'premium_monthly', 'family_monthly'
 *  - Link your Google Cloud project in Play Console > Monetize > Setup > API access
 *  - Grant the Firebase service account ({project}@appspot.gserviceaccount.com)
 *    the "Service Account User" role, and enable the Android Publisher API.
 */

import { Capacitor } from '@capacitor/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { log } from './logService';

// Product IDs — must exactly match what is created in Google Play Console
export const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_YEARLY: 'premium_yearly',
  FAMILY_MONTHLY: 'family_monthly',
  FAMILY_YEARLY: 'family_yearly',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// Maps store product ID → subscription tier written to Firestore
export const PRODUCT_TIER_MAP: Record<ProductId, 'premium' | 'family'> = {
  [PRODUCT_IDS.PREMIUM_MONTHLY]: 'premium',
  [PRODUCT_IDS.PREMIUM_YEARLY]: 'premium',
  [PRODUCT_IDS.FAMILY_MONTHLY]: 'family',
  [PRODUCT_IDS.FAMILY_YEARLY]: 'family',
};

export interface PurchaseResult {
  success: boolean;
  error?: string;
}

// cordova-plugin-purchase attaches CdvPurchase to the window object at runtime.
// We access it through window to avoid TypeScript undeclared-variable errors.
function getIAP(): any {
  return (window as any).CdvPurchase ?? null;
}

let _initialized = false;
let _currentUserId: string | null = null;

// Resolvers for in-flight purchases, keyed by productId
const _pendingResolvers = new Map<string, (ok: boolean, error?: string) => void>();

/**
 * Initialize the Play Store and register subscription products.
 * Safe to call multiple times — only initializes once.
 * Must be called before purchaseProduct() or getProductPrice().
 */
export async function initializePurchaseStore(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const IAP = getIAP();
  if (!IAP) {
    log.warn('[purchaseService] CdvPurchase not available — plugin not loaded', {}, 'purchaseService');
    return;
  }

  _currentUserId = userId;
  if (_initialized) return;
  _initialized = true;

  const { store, ProductType, Platform } = IAP;

  // Register subscription products
  store.register([
    {
      id: PRODUCT_IDS.PREMIUM_MONTHLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.GOOGLE_PLAY,
    },
    {
      id: PRODUCT_IDS.PREMIUM_YEARLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.GOOGLE_PLAY,
    },
    {
      id: PRODUCT_IDS.FAMILY_MONTHLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.GOOGLE_PLAY,
    },
    {
      id: PRODUCT_IDS.FAMILY_YEARLY,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.GOOGLE_PLAY,
    },
  ]);

  // Server-side receipt validator — calls our verifyPurchase Cloud Function
  const verifyFn = httpsCallable(functions, 'verifyPurchase');
  store.validator = async (receipt: any, callback: any) => {
    try {
      const result = await verifyFn({ receipt, userId: _currentUserId });
      callback({ ok: true, data: result.data as any });
    } catch (err: any) {
      log.error('[purchaseService] Receipt validation failed', { error: err?.message }, 'purchaseService');
      callback({ ok: false, code: 'VERIFICATION_FAILED', message: err?.message ?? 'Unknown error' });
    }
  };

  // Handle purchase lifecycle
  store
    .when()
    .approved((transaction: any) => {
      // Kick off server-side verification
      transaction.verify();
    })
    .verified((receipt: any) => {
      // Verification succeeded — finish the transaction to acknowledge it to Play
      receipt.finish();
      const productId = receipt.transactions?.[0]?.products?.[0]?.id as ProductId | undefined;
      const resolver = productId ? _pendingResolvers.get(productId) : undefined;
      if (resolver) {
        resolver(true);
        if (productId) _pendingResolvers.delete(productId);
      }
    })
    .unverified((receipt: any) => {
      // Verification failed — do not grant access
      const productId = receipt.transactions?.[0]?.products?.[0]?.id as ProductId | undefined;
      const resolver = productId ? _pendingResolvers.get(productId) : undefined;
      if (resolver) {
        resolver(false, 'Purchase could not be verified. Please try again.');
        if (productId) _pendingResolvers.delete(productId);
      }
    });

  await store.initialize([Platform.GOOGLE_PLAY]);
  log.info('[purchaseService] Store initialized', {}, 'purchaseService');
}

/**
 * Returns the localised price string for a product (e.g. "$4.99") as reported
 * by Google Play, or null if unavailable (web/iOS or store not yet loaded).
 */
export function getProductPrice(productId: ProductId): string | null {
  const IAP = getIAP();
  if (!IAP || !Capacitor.isNativePlatform()) return null;
  
  const product = IAP.store.get(productId, IAP.Platform.GOOGLE_PLAY);
  if (!product) return null;

  // For subscriptions, the price details are located on the active Offer (Base Plan) level
  const offer = typeof product.getOffer === 'function' ? product.getOffer() : null;
  if (offer && offer.pricing) {
    return offer.pricing.price ?? null;
  }

  return product.pricing?.price ?? null;
}

/**
 * Launch the Google Play billing flow for the given product ID.
 * Resolves after the purchase is verified server-side (or fails).
 */
export function purchaseProduct(productId: ProductId): Promise<PurchaseResult> {
  return new Promise((resolve) => {
    if (!Capacitor.isNativePlatform()) {
      resolve({ success: false, error: 'In-app purchases are only available on the Android app.' });
      return;
    }

    const IAP = getIAP();
    if (!IAP) {
      resolve({ success: false, error: 'Billing service not available.' });
      return;
    }

    const product = IAP.store.get(productId, IAP.Platform.GOOGLE_PLAY);
    if (!product) {
      resolve({
        success: false,
        error: 'Product not found. Ensure it is published in Google Play Console.',
      });
      return;
    }

    // Determine target to purchase: order the default active Offer (Base Plan) for subscriptions,
    // otherwise fall back to ordering the raw Product object.
    const offer = typeof product.getOffer === 'function' ? product.getOffer() : null;
    const orderTarget = offer || product;

    // Store the resolver so the verified/unverified handlers can settle it
    _pendingResolvers.set(productId, (ok, error) =>
      resolve(ok ? { success: true } : { success: false, error })
    );

    IAP.store.order(orderTarget).then((err: any) => {
      if (err) {
        _pendingResolvers.delete(productId);
        resolve({ success: false, error: err.message ?? 'Order failed' });
      }
    });
  });
}

/**
 * Ask Google Play to restore the user's existing purchases.
 * The verified() handler above will fire for any active subscriptions found.
 */
export function restorePurchases(): Promise<void> {
  const IAP = getIAP();
  if (!IAP || !Capacitor.isNativePlatform()) return Promise.resolve();
  return IAP.store.restorePurchases();
}
