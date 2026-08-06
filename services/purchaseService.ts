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
import { getCallableFunction } from '../firebaseConfig';
import { log } from './logService';
import { PRODUCT_TIER_MAP as GENERATED_PRODUCT_TIER_MAP } from '../constants/productTierMap';

// Product IDs — must exactly match what is created in Google Play Console
export const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_YEARLY: 'premium_yearly',
  FAMILY_MONTHLY: 'family_monthly',
  FAMILY_YEARLY: 'family_yearly',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

// Maps store product ID → subscription tier written to Firestore.
// Generated from constants/productTierMap.json (single source of truth shared
// with functions/src/googlePlayHelpers.ts — see .claude/audits/FIXES.md F63).
export const PRODUCT_TIER_MAP: Record<ProductId, 'premium' | 'family'> =
  GENERATED_PRODUCT_TIER_MAP as Record<ProductId, 'premium' | 'family'>;

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

// Last error returned by the server-side validator, surfaced to the user via the
// unverified() handler (which receives only the receipt, not the failure reason).
let _lastValidationError: string | null = null;

// Resolvers for in-flight purchases, keyed by productId
const _pendingResolvers = new Map<string, (ok: boolean, error?: string) => void>();

// Hard ceiling on how long purchaseProduct() may stay unsettled. The verified/
// unverified handlers resolve it on the happy paths, but both derive the productId
// from the receipt shape — if that lookup misses (or neither handler ever fires),
// the promise would otherwise hang forever and the UI pins on "Processing".
const PURCHASE_TIMEOUT_MS = 90_000;

/**
 * Settle every in-flight resolver. Used when a receipt arrives whose productId
 * can't be read, so we can still unblock the UI rather than leaving it hanging.
 */
function settleAllPending(ok: boolean, error?: string): void {
  for (const [productId, resolver] of _pendingResolvers) {
    resolver(ok, error);
    _pendingResolvers.delete(productId);
  }
}

/**
 * Resolve the pending resolver for a receipt. Falls back to settling all
 * in-flight purchases when the receipt's productId can't be determined —
 * a shape mismatch must surface as an error, never as an indefinite spinner.
 */
function settleForReceipt(receipt: any, ok: boolean, error?: string): void {
  // The verified/unverified handlers receive a Receipt whose product id may sit
  // in either shape depending on plugin version — check the validator-body form
  // (`id`) first, then the older nested transactions form. Getting this wrong
  // silently drops the resolver and hangs the purchase promise.
  const productId = (
    typeof receipt?.id === 'string'
      ? receipt.id
      : receipt?.transactions?.[0]?.products?.[0]?.id
  ) as ProductId | undefined;
  const resolver = productId ? _pendingResolvers.get(productId) : undefined;
  if (resolver) {
    resolver(ok, error);
    _pendingResolvers.delete(productId!);
    return;
  }
  log.warn(
    '[purchaseService] Could not map receipt to a pending purchase — settling all in-flight orders',
    { ok, productId: productId ?? null, receiptKeys: receipt ? Object.keys(receipt) : null },
    'purchaseService'
  );
  settleAllPending(ok, error);
}

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

  // Bind every purchase made through this store instance to the signed-in
  // Firebase uid. cordova-plugin-purchase obfuscates this value (per
  // `store.obfuscator`, default 'legacy' hashing) and sends it to Google Play
  // as `obfuscatedAccountId` on the purchase, which Play then surfaces back
  // to us as `obfuscatedExternalAccountId` on the purchase/subscription
  // resource. Setting it at the store level (rather than passing
  // `additionalData.applicationUsername` per-order) is the supported path —
  // the per-order field is deprecated because receipt re-validation later
  // (verifyPurchase.ts, subscriptionNotifications.ts) has no access to the
  // original order-time additionalData and would see a stale/undefined value.
  // This is defense-in-depth alongside the server-side purchaseTokens/{token}
  // -> uid binding check in verifyPurchase.ts; it lets us cross-check the
  // account association directly against Play's own record if ever needed.
  store.applicationUsername = () => _currentUserId ?? undefined;

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
  store.validator = async (receipt: any, callback: any) => {
    try {
      const verifyFn = await getCallableFunction('verifyPurchase');
      const result = await verifyFn({ receipt, userId: _currentUserId });
      callback({ ok: true, data: result.data as any });
    } catch (err: any) {
      // Log the receipt shape alongside the failure: a `invalid-argument` from
      // verifyPurchase means the server rejected this shape, and the keys are
      // what identify which field it could not read.
      log.error(
        '[purchaseService] Receipt validation failed',
        {
          error: err?.message,
          code: err?.code,
          details: err?.details,
          receiptKeys: receipt && typeof receipt === 'object' ? Object.keys(receipt) : null,
          firstTransactionKeys:
            Array.isArray(receipt?.transactions) && receipt.transactions[0]
              ? Object.keys(receipt.transactions[0])
              : null,
        },
        'purchaseService'
      );
      _lastValidationError = err?.message ?? null;
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
      _lastValidationError = null;
      settleForReceipt(receipt, true);
    })
    .unverified((receipt: any) => {
      // Verification failed — do not grant access. Prefer the validator's actual
      // message so a shape/config failure is diagnosable instead of generic.
      const reason = _lastValidationError
        ? `Purchase could not be verified: ${_lastValidationError}`
        : 'Purchase could not be verified. Please try again.';
      _lastValidationError = null;
      settleForReceipt(receipt, false, reason);
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
export function purchaseProduct(productId: ProductId, oldPurchaseToken?: string): Promise<PurchaseResult> {
  return new Promise((resolve) => {
    if (!Capacitor.isNativePlatform()) {
      if (import.meta.env.DEV) {
        log.info('[purchaseService] Mocking successful purchase for dev environment', { productId });
        resolve({ success: true });
        return;
      }
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

    // Store the resolver so the verified/unverified handlers can settle it.
    // Guarded so the promise settles exactly once, whichever path gets there
    // first (handler, order error, or the timeout below).
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      _pendingResolvers.delete(productId);
      log.error(
        '[purchaseService] Purchase timed out awaiting verification',
        { productId, timeoutMs: PURCHASE_TIMEOUT_MS },
        'purchaseService'
      );
      settled = true;
      resolve({
        success: false,
        error: 'Purchase is taking longer than expected. If you were charged, use Restore Purchases.',
      });
    }, PURCHASE_TIMEOUT_MS);

    const settle = (result: PurchaseResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    _pendingResolvers.set(productId, (ok, error) =>
      settle(ok ? { success: true } : { success: false, error })
    );

    // On a plan change (upgrade/downgrade/crossgrade), pass the old purchase token so
    // Play Billing treats this as a replace (SubscriptionUpdateParams) rather than an
    // independent second subscription — without it Play may double-charge or reject
    // the order. cordova-plugin-purchase's Google Play Offer.order() accepts this via
    // an additionalData.googlePlay object.
    const orderOptions = oldPurchaseToken
      ? {additionalData: {googlePlay: {oldPurchaseToken, replacementMode: 'IMMEDIATE_WITH_TIME_PRORATION'}}}
      : undefined;

    IAP.store.order(orderTarget, orderOptions).then(
      (err: any) => {
        if (err) {
          _pendingResolvers.delete(productId);
          settle({ success: false, error: err.message ?? 'Order failed' });
        }
      },
      (err: any) => {
        // order() rejecting (rather than resolving with an error) would otherwise
        // leave the promise pending until the timeout.
        _pendingResolvers.delete(productId);
        settle({ success: false, error: err?.message ?? 'Order failed' });
      }
    );
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
