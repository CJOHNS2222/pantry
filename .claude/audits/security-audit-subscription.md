# Security Audit — Subscription/Membership-Tier Entitlement
Date: 2026-08-05 | Auditor: security-auditor (subscription/entitlement-focused review) | Scope: firestore.rules, functions/src/verifyPurchase.ts, functions/src/subscriptionNotifications.ts, services/purchaseService.ts, hooks/useSubscription.ts, components/settings/SubscriptionManager.tsx, services/usageService.ts

Severity scale: CRITICAL / HIGH / MEDIUM / LOW
Note: F02 (verifyPurchase purchase-token replay) and F04 (billing/AI API keys shipped in client bundle) are already on record in security-audit.md (H3/H4) - not re-reported here.

---

## CRITICAL

### C1. ownerSubscriptionTier on the household doc is entirely client-writable - free members can self-grant unlimited family tier
**Files:** firestore.rules (households allow update block - checks only ownerIdUnchanged(), memberIdsChangeAllowed(), membersChangeAllowed(), withinHouseholdMemberCeiling(); no constraint on any other field), hooks/useSubscription.ts:99-109 (client writes ownerSubscriptionTier directly via updateDoc), services/usageService.ts:146-148 (non-admin member's usage-limit tier is taken straight from hData.ownerSubscriptionTier with no server-side revalidation).

households/{householdId} update rule never pins ownerSubscriptionTier to its prior value the way users/{userId} pins subscription via subscriptionUnchanged(). hooks/useSubscription.ts shows this is a real, live field: it is the mechanism the admin's own client is supposed to use to sync their tier onto the household doc - but nothing stops any authenticated member of the household (admin or not, paying or not) from calling updateDoc(households/{id}, { ownerSubscriptionTier: 'family' }) directly against the Firestore client SDK, bypassing the app UI entirely. There is also no restriction on this field at household create time.

**Exploit:** Attacker controls two accounts. Account A creates a household (free tier, no purchase) and, once created, writes ownerSubscriptionTier: 'family' directly to the household doc (single Firestore update() call - passes every rule check, since none of them look at this field). Account A invites Account B through the normal inviteMember/acceptInvitation flow (a real invite, so it is not blocked even if that flow itself is hardened). Account B is a non-admin member; hooks/useSubscription.ts:112-117 reads ownerSubscriptionTier: 'family' off the household doc and sets householdOwnerTier = 'family' for B, and services/usageService.ts:146-148 independently grants B family-tier usage limits from the same unguarded field. Neither account ever calls verifyPurchase or completes a Google Play purchase. Any number of accounts can be added as non-admin members of this household and all inherit unlimited/family-tier access for free, indefinitely - with no server-side function ever re-checking or overwriting the field.

**Fix:** In firestore.rules, add an ownerSubscriptionTierUnchanged()-style guard to the household update rule (client writes to this field must be rejected entirely - it should only ever be set by a trusted path). Preferably: stop writing it from the client altogether; have a Cloud Function (e.g. triggered from verifyPurchase/subscriptionNotifications.ts, or a Firestore onWrite trigger on users/{uid}.subscription for household owners) push the verified tier onto households/{id}.ownerSubscriptionTier with the Admin SDK, and lock the field to function-only writes the same way subscription is locked on users/{userId}.

---

## HIGH

### H1. No fallback re-check of subscription expiry - downgrade enforcement is a single point of failure on the Play RTDN webhook
**Files:** functions/src/subscriptionNotifications.ts (only trigger that ever downgrades a lapsed/cancelled/revoked subscription back to free), functions/src/resetUsageLimits.ts (weekly scheduled job resets usage counters only - never reads or compares subscription.current_period_end/status against Date.now()), functions/src/verifyPurchase.ts (only re-verifies with Play when the client explicitly calls it - purchase time or manual "Restore purchases").

There is no onSchedule function anywhere in functions/src that walks users/{uid}.subscription and re-verifies/expires stale entitlements. The entire downgrade path depends on: (a) Play's RTDN topic being correctly configured and never silently failing/dropping a SUBSCRIPTION_REVOKED/SUBSCRIPTION_EXPIRED message, and (b) the corresponding purchaseTokens/{token} doc already existing (it is a no-op with just a logger.warn if verifyPurchase was never called for that token). If RTDN delivery is ever missed for a given user (misconfigured topic, IAM permission drift on the publisher SA, transient Pub/Sub issue, or a user who bought a product no longer present in PRODUCT_TIER_MAP), a cancelled/expired subscription's tier field simply stays at its last-granted value forever - current_period_end is stored but nothing ever compares it to "now" outside of the RTDN handler.

**Impact:** A user who cancels/lets their subscription lapse keeps full paid-tier access indefinitely unless (1) the specific RTDN event happens to fire and be processed successfully, or (2) they personally trigger verifyPurchase again (which they have no incentive to do once they have stopped paying). This is a silent server-side entitlement-enforcement gap, not just a UX bug.

**Fix:** Add a scheduled function (daily is enough) that queries users where subscription.status in ['active','trialing'] and subscription.current_period_end < now, and downgrades them to free directly (or re-verifies via resolveSubscriptionState if a token is on file). This closes the gap regardless of RTDN reliability.

---

## MEDIUM

### M1. Optimistic client-side "upgrade" write to users/{uid}.subscription is expected to succeed but is actually blocked by rules
**File:** components/settings/SubscriptionManager.tsx:124-135, hooks/useSubscription.ts:129-146 (updateSubscription -> DatabaseMonitoringService.updateDoc(users/{uid}, { subscription: newSubscription })), firestore.rules (subscriptionUnchanged() on users/{userId} update).

After a real, server-verified purchaseProduct() succeeds, the UI calls updateSubscription({...}) as an "optimistic" direct client write to users/{uid}.subscription. Firestore rules correctly reject this (subscriptionUnchanged() requires the subscription map be byte-identical to the previous value on any client-initiated update) - so this call reliably fails with permission-denied on every single purchase. The failure is caught and only log.error'd; the user still sees "Success! You have upgraded..." Because verifyPurchase (the real grant) runs asynchronously and does actually update the doc moments later via the Admin SDK, entitlement is still correctly enforced today (this write is not the security boundary) - but the code path is dead/misleading, and it is exactly the kind of permission-denied noise a future refactor could "fix" by loosening subscriptionUnchanged(), which would reopen a client-side privilege-escalation hole identical in shape to C1.

**Fix:** Remove the optimistic client write (or scope updateSubscription to fields Firestore rules actually allow clients to own), and do not loosen subscriptionUnchanged() to accommodate it.

---

## Correctly Enforced (no finding)
- users/{userId}.subscription itself is properly locked: subscriptionUnchanged() on update and newSubscriptionIsFree() on create prevent a client from self-granting premium/family via a direct Firestore write to their own user doc.
- verifyPurchase.ts always live-queries Google Play (resolveSubscriptionState) rather than trusting client-asserted tier/expiry/status, so replaying an old purchaseToken cannot be used to keep refreshing entitlement after a real cancellation - Play's own API will report the token as expired/cancelled and the function rejects or downgrades accordingly.
- purchaseService.ts only mocks a successful purchase in import.meta.env.DEV (non-production build); every real purchase path routes through the server-verified store.validator -> verifyPurchase callable before receipt.finish() acknowledges it.

## Metrics
- Files reviewed: 9 (firestore.rules, verifyPurchase.ts, subscriptionNotifications.ts, googlePlayHelpers.ts, purchaseService.ts, useSubscription.ts, usageService.ts, SubscriptionManager.tsx, resetUsageLimits.ts)
- Findings: 3 (1 Critical, 1 High, 1 Medium)
