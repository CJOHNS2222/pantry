/**
 * verifyPurchase.ts — Firebase Cloud Function
 *
 * Verifies a Google Play subscription purchase token via the Android Publisher API,
 * then writes the subscription tier + expiry to users/{uid} in Firestore.
 *
 * Called automatically by cordova-plugin-purchase via purchaseService.ts.
 *
 * ── Setup required in Play Console ──────────────────────────────────────────
 *  1. Play Console → Setup → API access → Link to your Google Cloud project.
 *  2. In Google Cloud IAM, grant the App Engine service account
 *     ({project-id}@appspot.gserviceaccount.com) the "Service Account Token Creator" role.
 *  3. In Play Console API access page, grant the linked service account
 *     at least "View financial data" permission.
 *  4. Enable the "Google Play Android Developer API" in Cloud Console API library.
 * ────────────────────────────────────────────────────────────────────────────
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import admin from "firebase-admin";
import {getApps} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {PRODUCT_TIER_MAP, resolveSubscriptionState} from "./googlePlayHelpers";

if (!getApps().length) {
  admin.initializeApp();
}

export const verifyPurchase = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const {receipt} = (request.data ?? {}) as {receipt: any; userId: string};
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new HttpsError("invalid-argument", "Receipt is required and must be an object.");
  }

  // ── Validate the cordova-plugin-purchase receipt shape before touching it ──
  // Client input is untrusted: `receipt.transactions` must be a non-empty array,
  // and the first entry must carry a string token + product id in one of the
  // shapes the plugin emits, before we read anything off it.
  if (!Array.isArray(receipt.transactions) || receipt.transactions.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: transactions must be a non-empty array."
    );
  }

  const transaction = receipt.transactions[0];
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    throw new HttpsError("invalid-argument", "Invalid receipt: malformed transaction entry.");
  }

  const purchaseToken: string | undefined =
    typeof transaction.purchaseToken === "string" ? transaction.purchaseToken :
    typeof transaction.token === "string" ? transaction.token : undefined;

  const rawProductId: unknown =
    (Array.isArray(transaction.products) && transaction.products[0]?.id !== undefined
      ? transaction.products[0].id
      : transaction.productId);
  const productId: string | undefined = typeof rawProductId === "string" ? rawProductId : undefined;

  if (!purchaseToken || purchaseToken.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing or non-string purchaseToken."
    );
  }
  if (!productId || productId.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing or non-string productId."
    );
  }

  const tier = PRODUCT_TIER_MAP[productId];
  if (!tier) {
    throw new HttpsError("invalid-argument", `Unknown product: ${productId}`);
  }

  // ── Verify with Google Play Developer API ──────────────────────────────────
  let expiryMs: number;
  let status: "active" | "trialing" | "cancelled" | "past_due";

  try {
    const resolved = await resolveSubscriptionState(productId, purchaseToken);
    expiryMs = resolved.expiryMs;
    status = resolved.status;

    if (expiryMs < Date.now()) {
      throw new HttpsError("failed-precondition", "Subscription has expired.");
    }
    if (status === "past_due" && expiryMs >= Date.now()) {
      // paymentState 0 (pending) at initial purchase time, not yet a real renewal
      // failure — surface as pending rather than granting access.
      throw new HttpsError("failed-precondition", "Payment is still pending.");
    }
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;

    // Play API not accessible — likely missing IAM permissions.
    // Log the config error but do NOT fall back to trusting the client.
    logger.error('Android Publisher API call failed', { message: err.message });
    throw new HttpsError(
      "internal",
      `Play verification failed: ${err.message}. ` +
      "Ensure the Cloud Functions service account has Android Publisher API access " +
      "(see setup instructions in functions/src/verifyPurchase.ts)."
    );
  }

  // ── Update Firestore ────────────────────────────────────────────────────────
  const db = getFirestore();
  await db
    .collection("users")
    .doc(uid)
    .update({
      subscription: {
        tier,
        status,
        current_period_end: Timestamp.fromMillis(expiryMs),
        cancel_at_period_end: status === "cancelled",
        product_id: productId,
        purchase_token: purchaseToken,
        updated_at: Timestamp.now(),
      },
    });

  // purchaseToken → uid lookup for the Play RTDN webhook (subscriptionNotifications.ts),
  // which only receives the token/subscriptionId, never the Firebase uid.
  await db.collection("purchaseTokens").doc(purchaseToken).set({
    uid,
    productId,
    updated_at: Timestamp.now(),
  });

  logger.info('Subscription granted', { uid, tier, status });

  return {ok: true, tier, status, expiryMs};
});
