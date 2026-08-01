# Google Play Billing Setup

In-app purchases and subscriptions on Android are implemented via [`cordova-plugin-purchase`](https://github.com/j3k0/cordova-plugin-purchase) v13 (`CdvPurchase`), **not** a Capacitor-native billing plugin. Stripe and PayPal have been removed for Play Store compliance - Play Billing is the only purchase path.

## How It Works

- `services/purchaseService.ts` wraps `CdvPurchase` (attached to `window` at runtime by the plugin - accessed dynamically to avoid undeclared-variable TS errors).
- Flow: `initializePurchaseStore(userId)` once on app start (Android only) → `purchaseProduct(productId)` starts the billing flow → the plugin calls the `verifyPurchase` Cloud Function automatically → on success the function writes the subscription to Firestore → `useSubscription` picks it up client-side.
- `restorePurchases()` re-verifies existing subscriptions (e.g. after reinstall).
- Server-side receipt verification and Real-Time Developer Notification (RTDN) handling live in `functions/src/verifyPurchase.ts` / `functions/src/subscriptionNotifications.ts`.

## Product IDs

Must exactly match the subscription products created in Google Play Console:

| Product ID | Tier |
|---|---|
| `premium_monthly` | premium |
| `premium_yearly` | premium |
| `family_monthly` | family |
| `family_yearly` | family |

(`PRODUCT_IDS` / `PRODUCT_TIER_MAP` in `services/purchaseService.ts`.)

## Play Console Setup

1. Create the four subscription products above under **Monetize > Products > Subscriptions**.
2. Link the Google Cloud project under **Monetize > Setup > API access**.
3. Grant the Firebase service account (`{project}@appspot.gserviceaccount.com`) the **Service Account User** role, and enable the **Android Publisher API** in Google Cloud Console.
4. Configure RTDN (Real-Time Developer Notifications) to a Pub/Sub topic so `subscriptionNotifications.ts` receives renewal/cancellation events.

## Testing

- Use a [Play Console license tester account](https://developer.android.com/google/play/billing/test) - test purchases don't charge real money.
- `restorePurchases()` is the mechanism to verify cross-device/reinstall subscription recovery during QA.

## Related

- Purchase-token replay protection and `obfuscatedExternalAccountId` binding: `functions/src/verifyPurchase.ts` (see `.claude/audits/FIXES.md` F02).
- Tier limit defaults consumed after purchase: `services/remoteConfigService.ts` (`IN_APP_DEFAULTS`), enforced in `services/usageService.ts`.
