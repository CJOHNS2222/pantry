# API Audit - Subscription Plan-Switching (Play Billing)

Date: 2026-08-05 | Auditor: api-tester (static analysis only; no live API calls)
Scope: functions/src/verifyPurchase.ts, functions/src/subscriptionNotifications.ts, functions/src/googlePlayHelpers.ts, functions/src/index.ts, services/purchaseService.ts -- focused on the plan-switch (upgrade/downgrade/crossgrade) path, which has never been manually end-to-end tested.

Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO

Known finding on record, not re-reported here: F02 - verifyPurchase purchase-token replay across accounts (functions/src/verifyPurchase.ts:141-151, tracked as api-audit.md #3).

---

## Findings

### 1. [CRITICAL] Plan-switch RTDN handler never checks linkedPurchaseToken / whether the notified token is still the current token on file -- a superseded old-token event can clobber a valid new-tier grant
functions/src/subscriptionNotifications.ts:139-206, functions/src/googlePlayHelpers.ts:31-62

Walk the actual upgrade sequence (Premium to Family):

1. User is on premium_monthly, token A. users/uid.subscription = tier premium, product_id premium_monthly, purchase_token A. purchaseTokens/A maps to uid.
2. User taps upgrade to family_monthly. purchaseProduct(family_monthly) (services/purchaseService.ts:184-227) calls IAP.store.order(...) -- no oldPurchaseToken/proration mode is passed explicitly by app code; Play issues a new token B for family_monthly and marks the old purchase on token A as replaced/cancelled (cancelReason set, linkedPurchaseToken on the new purchase pointing back to A).
3. Client verified() handler eventually calls verifyPurchase with token B, correctly overwrites users/uid.subscription to tier family, product_id family_monthly, purchase_token B, and writes purchaseTokens/B maps to uid. This part is correct when it runs.
4. Independently, Play fires an RTDN for the old token A -- typically SUBSCRIPTION_CANCELED (type 3), sometimes later SUBSCRIPTION_EXPIRED (type 13). purchaseTokens/A still maps to uid (nothing ever deletes/marks it stale). The handler resolves tier = PRODUCT_TIER_MAP[premium_monthly] = premium and either:
   - (CANCELED, non-immediate path, subscriptionNotifications.ts:181-199) calls resolveSubscriptionState(premium_monthly, A) against Play, gets back status derived from the now-replaced old purchase (cancelled/past_due, stale expiryMs), and does an unconditional userRef.update on the full subscription map, overwriting it with tier premium -- not a merge.
   - (EXPIRED/REVOKED, immediate path, subscriptionNotifications.ts:160-176) unconditionally sets tier to free.

Neither branch ever reads linkedPurchaseToken from the Play API response, and neither checks whether the purchaseToken from this notification equals users/uid.subscription.purchase_token on file before writing. So:

- If the old-token event lands after step 3, it silently reverts the user from family/active back to premium (or even free) despite the user actively paying for Family -- a paid-tier user gets downgraded by their own successful upgrade.
- If step 3 never happens (app backgrounded/killed mid-checkout before transaction.verify() fires, common on Android when the Play billing sheet backgrounds the app) there is no other automatic recovery: restorePurchases() (services/purchaseService.ts:234-238) is only invoked manually from a button in components/settings/SubscriptionManager.tsx:480 -- nothing calls it on app resume/start. The user is left on whatever the old-token RTDN wrote (stale/cancelled premium, or free) until they happen to open Settings and tap Restore Purchases, despite having successfully paid Play for Family.
- The purchaseTokens/A doc is never cleaned up or marked superseded, so this is not a one-time race: any future delayed/retried RTDN for the dead old token (Pub/Sub redelivery, or Play sending a late EXPIRED for A months after the upgrade) will still resolve to the same uid and can stomp whatever tier the user has since legitimately purchased.

Fix: In resolveSubscriptionState or the webhook handler, before writing, either (a) compare the notification purchaseToken against users/uid.subscription.purchase_token and no-op if it does not match the token currently on file (the simplest guard -- an old/superseded token should never override a newer one), or (b) fetch the purchase via purchases.subscriptionsv2.get and check linkedPurchaseToken: if present, treat the notification as informational about a now-inactive predecessor purchase, look up the linked (new) token state instead, and never downgrade based on the old token terminal status. Also mark/delete purchaseTokens/oldToken once superseded so late redeliveries become genuine no-ops via the purchaseTokens lookup itself.

### 2. [MEDIUM] RTDN failures are silently ACKed and never retried -- retry is not enabled on the trigger, and the catch block swallows Play API errors without rethrowing
functions/src/subscriptionNotifications.ts:86-89, functions/src/subscriptionNotifications.ts:181-206

onMessagePublished with topic play-store-notifications and region us-east1 does not set retry true (default false in Cloud Functions v2 -- a failed invocation is not redelivered by Pub/Sub, it is just logged and dropped). Compounding that, the re-verify branch (subscriptionNotifications.ts:181-206) explicitly catches the resolveSubscriptionState error and only logger.error logs it -- it does not rethrow, so the function returns success even on failure. This defeats the whole point of a transient-failure story: on a rate limit, expired Play API auth token, or a transient 5xx from androidpublisher.purchases.subscriptions.get, the event is:
- not written anywhere in Firestore (safe -- no partial/wrong write, consistent with the audit ask), but
- permanently dropped -- Pub/Sub sees an ACK either way (explicit swallow in the try/catch, or an implicit ACK for the uncaught-throw immediate-downgrade path since retry is off), so there is no second chance for that specific RTDN. If it happened to be the notification for a plan-change event, the user tier can be left stale indefinitely with nothing to trigger a correction until the next unrelated RTDN or a manual restore.

Fix: set retry true on the trigger and rethrow inside the catch (subscriptionNotifications.ts:200-206) so a transient failure is genuinely retried by Pub/Sub built-in redelivery/backoff instead of being logged and forgotten. If indefinite retries are undesirable, pair with a dead-letter topic rather than swallow-and-drop.

---

## Checked and already correct (per audit scope, not re-reported as findings)

- Idempotency of same-notification redelivery (subscriptionNotifications.ts:160-206): both write paths fully overwrite subscription from freshly-resolved truth (Play API re-fetch, or hardcoded terminal state) rather than incrementing/appending anything, so a duplicate delivery of the same notification for the same token is a safe no-op rewrite. The bug is specifically the cross-token (old vs new, superseded-purchase) case in Finding 1, not literal at-least-once redelivery.
- notificationType numeric codes (subscriptionNotifications.ts:35-49): all 13 enum values match Google documented RTDN notificationType codes exactly (1=RECOVERED through 13=EXPIRED). ACTIONABLE_TYPES correctly omits only PRICE_CHANGE_CONFIRMED (8) and PAUSE_SCHEDULE_CHANGED (11), both of which genuinely do not change current access per Play docs -- no branch is silently falling through to a wrong/missing handler.
- Webhook auth (subscriptionNotifications.ts:86-89, functions/src/index.ts:14): this is a native onMessagePublished (Eventarc/Pub/Sub) trigger, not a hand-rolled HTTP push endpoint -- Cloud Functions v2 gen2 pubsub triggers are invoked only via the platform-managed Eventarc trigger service account and are not reachable by an arbitrary unauthenticated POST by default, so there is no missing-OIDC-verification gap to fix in code. Not verified here: post-deploy IAM bindings were not checked for accidental public invocation -- that is an infra/deploy check, out of scope for static code analysis.

---

## Metrics

- Files reviewed: 5 (functions/src/verifyPurchase.ts, functions/src/subscriptionNotifications.ts, functions/src/googlePlayHelpers.ts, functions/src/index.ts, services/purchaseService.ts)
- Findings: 2 (1 CRITICAL, 1 MEDIUM)
- Pre-existing/known findings referenced, not re-counted: 1 (F02)
