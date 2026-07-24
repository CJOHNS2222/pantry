---
agent: env-validator
status: fail
findings: 8
---

## Summary

Two credential-shaped files (`private.pem`, `public.pem`) and one encrypted asset (`com.smart.pantry.enc`) are **tracked in git and not covered by `.gitignore`** — this is the critical issue driving `status: fail`. `VITE_firebaseConfig.ts` is also tracked (contrary to what CLAUDE.md implies), though its current contents are safe (only `import.meta.env.VITE_*` references, no literal secrets). `.env.example` is missing ~15 VITE_ vars actually used in code, mostly grocery-checkout affiliate IDs and the OpenRouter/Sentry/reCAPTCHA vars. No hardcoded API keys or PEM blocks were found inside committed `.ts`/`.tsx`/`.js` source files (the `AIza`-style keys that did turn up live in `android/app/google-services.json`, `firebase-service-account.json`, and a generated build asset — all of which are gitignored or not tracked). `functions/` has minimal explicit env-var surface; Google Play Publisher API access relies on Application Default Credentials (no secret env var to leak), but this dependency isn't documented anywhere in `readme/`.

## Findings

### 1. [CRITICAL] `private.pem` tracked in git, not in `.gitignore`
- **Location:** `C:\Users\cjohn\pantry\private.pem` (repo root)
- **Description:** `git ls-files | grep private.pem` confirms it is committed. `git check-ignore -v private.pem` returns nothing → not ignored. File content starts with `-----BEGIN ENCRYPTED PRIVATE KEY-----` (PKCS#8, encrypted, but still a private key artifact that shouldn't live in version control — likely used for Android/IAP receipt or `cordova-plugin-purchase` signature verification given the sibling `com.smart.pantry.enc` file).
- **Remediation:** Add `private.pem`, `public.pem` to `.gitignore`. Since it's already tracked, adding to `.gitignore` alone won't remove it from history — run `git rm --cached private.pem public.pem`, commit, and if this key is used for anything security-sensitive (IAP signature verification, code signing), rotate/regenerate it since it's already exposed in git history. Confirm with the team whether the encryption passphrase alone is sufficient protection or whether full history scrubbing (BFG/filter-repo) is warranted.

### 2. [HIGH] `public.pem` tracked in git, not in `.gitignore`
- **Location:** `C:\Users\cjohn\pantry\public.pem` (repo root)
- **Description:** Same as above — tracked, not ignored. Lower severity than the private key since public keys are generally safe to expose, but pairing it with the tracked private key suggests neither was ever meant to be committed.
- **Remediation:** Same as #1 — add to `.gitignore`, `git rm --cached`.

### 3. [HIGH] `com.smart.pantry.enc` tracked in git, not in `.gitignore`
- **Location:** `C:\Users\cjohn\pantry\com.smart.pantry.enc` (repo root)
- **Description:** Tracked and not covered by any `.gitignore` pattern. Given the filename (matches `capacitor.config.ts` `appId: com.smart.pantry`) and the co-located `.pem` pair, this is very likely an encrypted IAP/licensing or signing artifact tied to `cordova-plugin-purchase` (mentioned in CLAUDE.md's Capacitor section).
- **Remediation:** Add to `.gitignore` (e.g. `*.enc` or the literal filename), `git rm --cached com.smart.pantry.enc`. Verify whether this needs to ship inside the Android app bundle (in which case it should be sourced from `android/` build assets, not repo root) rather than being committed to source control.

### 4. [MEDIUM] `VITE_firebaseConfig.ts` is tracked in git
- **Location:** `C:\Users\cjohn\pantry\VITE_firebaseConfig.ts`
- **Description:** `git ls-files` shows this file is committed. Per CLAUDE.md: "Actual SDK config values come from `VITE_firebaseConfig.ts` (not generic env example)" — the phrasing implies this file is expected to hold real config and therefore should not be tracked. In its **current** state the file only contains `import.meta.env.VITE_*` passthroughs (no literal secrets), so there is no active leak today. But because it's untracked-by-.gitignore, any future edit that hardcodes a real value directly (which the CLAUDE.md description suggests is the intended pattern in some setups) would get committed silently.
- **Remediation:** Either (a) add `VITE_firebaseConfig.ts` to `.gitignore` and commit a `VITE_firebaseConfig.example.ts` template instead, matching the stated intent in CLAUDE.md, or (b) if the current passthrough-only pattern is the actual intended design, update CLAUDE.md's wording so it doesn't mislead future contributors into hardcoding values in a tracked file.

### 5. [LOW] `.env.example` missing several `VITE_*` vars used in code
- **Location:** `C:\Users\cjohn\pantry\.env.example` vs. actual `import.meta.env.VITE_*` usages across `services/`, `components/`
- **Description:** Vars referenced in source but absent from `.env.example`:
  - `services/sentryService.ts`, `index.tsx`: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`
  - `firebaseConfig.ts`: `VITE_RECAPTCHA_SITE_KEY`
  - `services/openRouterService.ts`: `VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_BASE_URL`, `VITE_OPENROUTER_MODEL`, `VITE_OPENROUTER_VISION_MODEL`
  - `services/groceryCheckoutService.ts`: `VITE_IMPACT_PUBLISHER_ID`, `VITE_WALMART_CAMPAIGN_ID`, `VITE_WALMART_AD_ID`, `VITE_TARGET_CAMPAIGN_ID`, `VITE_TARGET_AD_ID`, `VITE_KROGER_CAMPAIGN_ID`, `VITE_KROGER_AD_ID`, `VITE_INSTACART_CAMPAIGN_ID`, `VITE_INSTACART_AD_ID`, `VITE_ALBERTSONS_CAMPAIGN_ID`, `VITE_ALBERTSONS_AD_ID`, `VITE_THRIVE_CAMPAIGN_ID`, `VITE_THRIVE_AD_ID`
- **Remediation:** Add these keys (with placeholder values) to `.env.example` so new contributors know the full surface area, particularly the per-retailer affiliate campaign/ad IDs which are easy to miss and would silently break checkout links if unset.

### 6. [LOW] `.env.example` has entries that appear stale/unused
- **Location:** `C:\Users\cjohn\pantry\.env.example` lines for `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CSE_API_KEY`, `VITE_GOOGLE_CSE_ID`, `VITE_MEASUREMENT_ID`
- **Description:** No `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CSE_*`, or `VITE_MEASUREMENT_ID` reads found anywhere in `components/`, `hooks/`, `services/`, `contexts/`, `utils/`, `src/`. CLAUDE.md confirms monetization is via Google Play Billing (`cordova-plugin-purchase`), not Stripe, and `VITE_firebaseConfig.ts` has a comment `// measurementId removed to prevent Google Analytics loading issues` — consistent with these being leftover from an earlier implementation.
- **Remediation:** Either confirm these are genuinely dead (and remove from `.env.example` to reduce onboarding confusion) or, if Stripe/CSE are used in Cloud Functions / server-side code not covered by this VITE_ grep, note that explicitly.

### 7. [INFO] `VITE_GEMINI_DISABLED` documented only as a comment, not read via `import.meta.env`
- **Location:** `services/openRouterService.ts:15` (comment), also referenced in `CLAUDE.md` and `CHANGELOG.md`
- **Description:** CLAUDE.md states "`VITE_GEMINI_DISABLED=true` routes all AI through OpenRouter," and the same string appears as a code comment in `openRouterService.ts`, but no `import.meta.env.VITE_GEMINI_DISABLED` read was found in the grep of `components/hooks/services/contexts/utils/src`. Either the actual read lives somewhere outside those directories (e.g. a top-level file) or this flag is currently a documentation-only/aspirational toggle.
- **Remediation:** Verify where (if anywhere) `VITE_GEMINI_DISABLED` is actually consumed; if it's not wired up, update CLAUDE.md/the comment to avoid misleading contributors, or add it to `.env.example` if it is real.

### 8. [LOW] `functions/` Google Play Publisher API credential path undocumented
- **Location:** `functions/src/googlePlayHelpers.ts:17-23` (`getAndroidPublisher()`), used by `functions/src/verifyPurchase.ts` and `functions/src/subscriptionNotifications.ts`
- **Description:** `new google.auth.GoogleAuth({ scopes: [...] })` is called with no explicit key file or credentials object, meaning it relies on Application Default Credentials — i.e., the Cloud Functions runtime service account. This is safe (no secret env var needed / nothing to leak in source), but the *setup step* it silently depends on — granting that service account "Financial data" / Android Publisher API access in Play Console — isn't documented in `readme/` (checked `HOUSEHOLD_INVITATION_SETUP.md`, `RECIPE_DATABASE_SETUP.md`, etc.; none mention Play Console service-account linkage). `functions/.env.example` only documents `EMAIL_USER`/`EMAIL_PASSWORD`/`APP_URL` (Gmail/nodemailer config), nothing about IAP verification setup.
- **Remediation:** Add a short `readme/GOOGLE_PLAY_BILLING_SETUP.md` (or extend an existing doc) noting: no env var is required for `verifyPurchase.ts`/`subscriptionNotifications.ts` locally, but the Cloud Functions default service account must be linked in Google Play Console with Android Publisher API access, or deploys will fail purchase verification silently in production while working fine in code review.

## Verified OK

- `.gitignore` correctly covers: `.env` / `.env.*` (with `.env.example` allow-listed), `*-service-account.json` (confirmed `firebase-service-account.json` matches and is untracked), `google-services.json`, `pantry-release.keystore`, `key`/`keyid`/`keyid.pub`, `sentry.properties`/`.sentryclirc`, `*.apk`/`*.aab`.
- `firebase-service-account.json`, `android/app/google-services.json`, `scripts/ornate-compass-478504-e1-firebase-adminsdk-fbsvc-b421e3c5e1.json` — all present on disk, matched by `.gitignore`, and confirmed **not tracked** by `git ls-files`.
- No hardcoded `AIza...`, `-----BEGIN PRIVATE KEY-----`, `sk_live_`/`sk_test_` patterns found inside committed `.ts`/`.tsx`/`.js` application source (only inside already-gitignored JSON/build-asset files).
- `functions/src` has no direct `process.env.*` reads outside the documented Gmail/App URL vars in `functions/.env.example`.

## Metrics

- Distinct `VITE_*` env vars referenced in app source: **32**
- `VITE_*` vars documented in `.env.example`: **19** (of which ~4 appear unused/stale)
- `VITE_*` vars used in code but missing from `.env.example`: **15**
- Sensitive/credential-shaped files tracked in git despite not being generic env files: **3** (`private.pem`, `public.pem`, `com.smart.pantry.enc`) + **1** borderline (`VITE_firebaseConfig.ts`)
- Hardcoded secret-pattern hits in committed application source (`.ts`/`.tsx`/`.js`, excluding already-gitignored files): **0**
