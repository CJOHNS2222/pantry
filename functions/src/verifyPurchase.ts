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
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {google} from "googleapis";

if (!admin.apps?.length) {
  admin.initializeApp();
}

const PACKAGE_NAME = "com.smart.pantry";

const PRODUCT_TIER_MAP: Record<string, "premium" | "family"> = {
  premium_monthly: "premium",
  family_monthly: "family",
};

async function getAndroidPublisher() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const authClient = await auth.getClient();
  return google.androidpublisher({version: "v3", auth: authClient as any});
}

export const verifyPurchase = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const {receipt} = (request.data ?? {}) as {receipt: any; userId: string};
  if (!receipt) {
    throw new HttpsError("invalid-argument", "Receipt is required.");
  }

  // Extract fields from the cordova-plugin-purchase receipt
  const transaction = receipt.transactions?.[0];
  const purchaseToken: string | undefined =
    transaction?.purchaseToken ?? transaction?.token;
  const productId: string | undefined =
    transaction?.products?.[0]?.id ?? transaction?.productId;

  if (!purchaseToken || !productId) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing purchaseToken or productId."
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
    const androidPublisher = await getAndroidPublisher();
    const {data} = await androidPublisher.purchases.subscriptions.get({
      packageName: PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken,
    });

    expiryMs = parseInt(data.expiryTimeMillis ?? "0", 10);

    if (expiryMs < Date.now()) {
      throw new HttpsError("failed-precondition", "Subscription has expired.");
    }

    // paymentState: 0=pending, 1=received, 2=free trial, 3=deferred
    const paymentState = data.paymentState ?? 1;
    if (paymentState === 0) {
      throw new HttpsError("failed-precondition", "Payment is still pending.");
    }

    const isTrial = paymentState === 2;
    const isCancelled = data.cancelReason !== undefined && data.cancelReason !== null;

    status = isCancelled ? "cancelled" : isTrial ? "trialing" : "active";
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

  logger.info('Subscription granted', { uid, tier, status });

  return {ok: true, tier, status, expiryMs};
});
