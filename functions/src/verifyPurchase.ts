/**
 * verifyPurchase.ts — Firebase Cloud Function
 *
 * Verifies a Google Play subscription purchase token via the Android Publisher API,
 * then writes the subscription tier + expiry to users/{uid} in Firestore.
 *
 * Called automatically by cordova-plugin-purchase via purchaseService.ts.
 *
 * ── Setup required in Play Console ──────────────────────────────────────────
 * The identity that must be authorized is the function's RUNTIME service
 * account. For Gen-2 Cloud Functions that is the Compute Engine default
 * account, NOT the App Engine one:
 *
 *     {project-number}-compute@developer.gserviceaccount.com
 *
 * (An earlier version of this comment named {project-id}@appspot.gserviceaccount.com.
 * Granting that account instead produces a Play API 401 `permissionDenied` on
 * every purchase — the call is authenticated but the calling identity has no
 * app access. Confirm the live value with:
 *   gcloud functions describe verifyPurchase --region=us-east1 --gen2 \
 *     --format='value(serviceConfig.serviceAccountEmail)'
 * rather than assuming, since it changes if the function is redeployed with an
 * explicit --service-account.)
 *
 *  1. Play Console → Setup → API access → link to your Google Cloud project.
 *     The grant page only lists accounts from the linked project.
 *  2. On that page, grant the runtime service account above:
 *       - app access scoped to PACKAGE_NAME (com.smart.pantry), and
 *       - "View financial data, orders, and cancellation survey responses"
 *         — the permission purchases.subscriptions.get actually requires.
 *  3. Enable the "Google Play Android Developer API" in the Cloud Console
 *     API library.
 *
 * Play Console permission changes propagate on their own schedule — 15 minutes
 * to a few hours is normal. A 401 immediately after granting does not mean the
 * grant failed. The full Play rejection (code/status/apiError) is logged by the
 * catch block below; `err.message` alone is empty and will not show the reason.
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

// 120s: default 60s was too tight once the Play API calls got explicit 15s timeouts
// (see GOOGLE_API_TIMEOUT_MS in googlePlayHelpers.ts) — worst case is up to 4 Play API
// calls (initial + 3 retries) plus backoff sleeps, which can approach 60s on its own.
export const verifyPurchase = onCall({ enforceAppCheck: false, timeoutSeconds: 120 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const {receipt} = (request.data ?? {}) as {receipt: any; userId: string};

  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new HttpsError("invalid-argument", "Receipt is required and must be an object.");
  }

  // ── Validate the cordova-plugin-purchase receipt shape before touching it ──
  // Client input is untrusted, so every field is checked before it is read.
  //
  // What the plugin actually sends is `CdvPurchase.Validator.Request.Body`
  // (cordova-plugin-purchase v13.18, www/store.d.ts:6390), NOT a Receipt:
  //   { id, type, offers[], transaction, additionalData, device }
  // The Google purchase token lives on the SINGULAR `transaction` object
  // (`ApiValidatorBodyTransactionGoogle`, store.d.ts:6525) as
  // `transaction.purchaseToken`, with `transaction.type === 'android-playstore'`.
  //
  // An earlier version of this function expected a plural `transactions` array
  // and rejected every real purchase with `invalid-argument` — note the offer
  // tokens inside `offers[]` are catalog identifiers, NOT purchase tokens, so
  // they must never be used here.
  const transaction = receipt.transaction;
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    logger.warn("verifyPurchase rejected: receipt.transaction missing or malformed", {
      uid,
      receiptKeys: Object.keys(receipt),
    });
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing transaction details."
    );
  }

  // Primary path is `transaction.purchaseToken`; the rest are tolerated fallbacks
  // for older/other plugin shapes so a future plugin change degrades gracefully
  // rather than hard-failing every purchase again.
  const purchaseToken: string | undefined =
    typeof transaction.purchaseToken === "string" ? transaction.purchaseToken :
    typeof transaction.token === "string" ? transaction.token :
    typeof receipt.purchaseToken === "string" ? receipt.purchaseToken : undefined;

  // Product id is the top-level `id` on the validator body. Fall back to the
  // transaction's own product fields if a future shape moves it.
  const rawProductId: unknown =
    typeof receipt.id === "string" ? receipt.id :
      (Array.isArray(transaction.products) && transaction.products[0]?.id !== undefined
        ? transaction.products[0].id
        : transaction.productId);
  const productId: string | undefined = typeof rawProductId === "string" ? rawProductId : undefined;

  if (!purchaseToken || purchaseToken.trim().length === 0) {
    logger.warn("verifyPurchase rejected: no purchaseToken in any known field", {
      uid,
      receiptKeys: Object.keys(receipt),
      transactionKeys: Object.keys(transaction),
    });
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing or non-string purchaseToken."
    );
  }
  if (!productId || productId.trim().length === 0) {
    logger.warn("verifyPurchase rejected: no productId in any known field", {
      uid,
      transactionKeys: Object.keys(transaction),
      productsIsArray: Array.isArray(transaction.products),
    });
    throw new HttpsError(
      "invalid-argument",
      "Invalid receipt: missing or non-string productId."
    );
  }

  const tier = PRODUCT_TIER_MAP[productId];
  if (!tier) {
    logger.warn("verifyPurchase rejected: productId not in PRODUCT_TIER_MAP", {
      uid,
      productId,
      knownProducts: Object.keys(PRODUCT_TIER_MAP),
    });
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
    // googleapis errors put the useful detail on `response.data.error` /
    // `code`, NOT on `message` (which is often empty) — logging only `message`
    // here previously reduced a config failure to a blank string, hiding
    // whether it was auth, permissions, or a bad product/token.
    logger.error(
      'Android Publisher API call failed. Ensure the Cloud Functions service account ' +
      'has Android Publisher API access (see setup instructions in functions/src/verifyPurchase.ts).',
      {
        message: err?.message ?? null,
        code: err?.code ?? null,
        status: err?.response?.status ?? null,
        apiError: err?.response?.data?.error ?? null,
        errors: err?.errors ?? null,
        productId,
        tokenPrefix: purchaseToken.slice(0, 12),
      }
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
