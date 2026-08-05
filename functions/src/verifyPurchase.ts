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
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {PRODUCT_TIER_MAP, resolveSubscriptionState, syncOwnerSubscriptionTier} from "./googlePlayHelpers";

if (!getApps().length) {
  initializeApp();
}

export const verifyPurchase = onCall({ enforceAppCheck: false }, async (request) => {
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

  // On GooglePlay, cordova-plugin-purchase v13 puts purchaseToken on the Receipt
  // object, not the Transaction — CdvPurchase.GooglePlay.Receipt.purchaseToken,
  // vs the base CdvPurchase.Transaction class which carries no token field at all.
  const purchaseToken: string | undefined =
    typeof receipt.purchaseToken === "string" ? receipt.purchaseToken :
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
    // Right after checkout, Play's Developer API can briefly still report
    // paymentState 0 (pending) for a purchase that already succeeded client-side —
    // propagation lag, not a real payment failure. Retry a few times with backoff
    // before surfacing it as pending.
    let resolved = await resolveSubscriptionState(productId, purchaseToken);
    for (let attempt = 0; resolved.status === "past_due" && resolved.expiryMs >= Date.now() && attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      resolved = await resolveSubscriptionState(productId, purchaseToken);
    }
    expiryMs = resolved.expiryMs;
    status = resolved.status;

    if (expiryMs < Date.now()) {
      throw new HttpsError("failed-precondition", "Subscription has expired.");
    }
    if (status === "past_due" && expiryMs >= Date.now()) {
      // Still pending after retries — a real hold/decline, not propagation lag.
      throw new HttpsError("failed-precondition", "Payment is still pending.");
    }
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;

    // Play API not accessible — likely missing IAM permissions.
    // Log the config error server-side (with full detail) but do NOT fall back to
    // trusting the client, and do NOT forward the raw error message to it —
    // internal API/config details (service account, project setup) shouldn't
    // leak to callers.
    logger.error(
      'Android Publisher API call failed. Ensure the Cloud Functions service account ' +
      'has Android Publisher API access (see setup instructions in functions/src/verifyPurchase.ts).',
      { message: err.message }
    );
    throw new HttpsError("internal", "Purchase verification failed. Please try again later.");
  }

  // ── Update Firestore ────────────────────────────────────────────────────────
  // purchaseToken → uid binding must be established (or checked) and the
  // entitlement grant must happen atomically in the same transaction. A single
  // Play purchase token belongs to exactly one Firebase account for its
  // lifetime — without this check, a shared/leaked receipt token could be
  // replayed from any number of accounts, and each replay would silently
  // steal the `purchaseTokens/{token}` -> uid mapping (which the RTDN webhook
  // in subscriptionNotifications.ts relies on to route renewal/cancellation
  // events), pointing future Play webhooks at the wrong user.
  const db = getFirestore();
  const tokenRef = db.collection("purchaseTokens").doc(purchaseToken);
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const tokenSnap = await tx.get(tokenRef);
    if (tokenSnap.exists) {
      const existingUid = tokenSnap.data()?.uid;
      if (existingUid && existingUid !== uid) {
        throw new HttpsError(
          "already-exists",
          "This purchase is already associated with a different account."
        );
      }
    }

    tx.update(userRef, {
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
    // merge:true so re-verification/renewal of the same (token, uid) pair
    // just refreshes updated_at rather than requiring the doc to pre-exist.
    tx.set(
      tokenRef,
      {
        uid,
        productId,
        updated_at: Timestamp.now(),
      },
      {merge: true}
    );
  });

  // Only acknowledge/grant once the transaction above has committed — the
  // client's store.validator() callback (purchaseService.ts) only calls
  // receipt.finish() (which acknowledges the purchase to Play) after this
  // function resolves with {ok: true}. If the transaction threw above, this
  // line is never reached and the client's `.unverified()` handler fires
  // instead, so the purchase is never acknowledged.
  logger.info('Subscription granted', { uid, tier, status });

  // Non-fatal: household-tier sync failing shouldn't fail an already-committed,
  // already-acknowledged purchase.
  await syncOwnerSubscriptionTier(db, uid, tier).catch((err: any) =>
    logger.error('Failed to sync ownerSubscriptionTier', { uid, message: err.message })
  );

  return {ok: true, tier, status, expiryMs};
});
