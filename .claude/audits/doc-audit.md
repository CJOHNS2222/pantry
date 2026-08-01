# Documentation Audit — Stock & Spoon
Date: 2026-07-31 | Auditor: doc-auditor | Method: graphify-oriented (graph.json queries), then targeted file verification

## 1. CLAUDE.md accuracy vs actual code

### H1. Changelog direction stated backwards (HIGH)
`CLAUDE.md` Commands section says `predev`/`prebuild` "regenerate CHANGELOG.md". Actual flow is the reverse: `scripts/generate-changelog.cjs` **reads** `CHANGELOG.md` (manually maintained source of truth) and **writes** `constants/changelogEntries.ts` (top 3 versions, max 4 highlights, consumed by `WhatsNewModal.tsx` / `ChangelogPage.tsx` / `GlobalUpdatePrompt.tsx`). Anyone following the doc would edit the wrong file. Fix: "predev/prebuild regenerate `constants/changelogEntries.ts` from CHANGELOG.md".

### H2. Household-member caps not in IN_APP_DEFAULTS as claimed (MEDIUM)
`CLAUDE.md` says tier limit defaults (including "2 household members") live in `services/remoteConfigService.ts` `IN_APP_DEFAULTS`. Actual keys there (L73-89) are only `limit_{tier}_{searches_weekly,recipes_max,mealplanning_weekly,gemini_weekly}` — no member-cap key. Member caps are enforced elsewhere. Also `IN_APP_DEFAULTS` includes a `gemini_weekly` limit dimension (5/15/-1) that neither CLAUDE.md nor README mentions.

### H3. Commands section incomplete (LOW-MEDIUM)
Missing from CLAUDE.md but present in `package.json`:
- `npm run test:rules` — Firestore security-rules tests (`vitest.rules.config.ts`); nowhere documented despite CLAUDE.md stressing that `firestore.rules` checks must be preserved.
- `npm run build:release` / `sync-release-notes` / `version:publish` — release pipeline scripts (release skill exists, but repo docs don't cover them).
- `npm run generate:changelog`, `npm run dashboard`.
Verified accurate: `npm test` is single-run (`watch: false` in `vitest.config.ts`), Playwright `*.pw.ts` note, path alias, `react-router-dom` present-but-unused claim (dep at package.json L124).

### H4. graphify wiki claim (INFO)
CLAUDE.md graphify section references `graphify-out/wiki/index.md` conditionally — it does not exist. Harmless (guarded by "if exists") but worth pruning to avoid a dead pointer.

## 2. Undocumented / stale env vars

### E1. `.env.example` missing ~20 vars used by app code (HIGH)
(Confirms and extends prior `.claude/audits/env-validator.md` finding 5.)
Used in runtime code but absent from `.env.example`:
- `VITE_RECAPTCHA_SITE_KEY` (`firebaseConfig.ts` — App Check; setup will silently skip without it)
- `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` (`index.tsx`, `services/sentryService.ts`)
- `VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_BASE_URL`, `VITE_OPENROUTER_MODEL`, `VITE_OPENROUTER_VISION_MODEL`, `VITE_GEMINI_DISABLED` (`services/openRouterService.ts` — the documented AI fallback path is entirely unconfigurable from the example file)
- `VITE_ENABLE_GEMINI` (`services/featureFlags.ts`)
- `VITE_UNSPLASH_ACCESS_KEY` (`services/imageService.ts`)
- `VITE_IMPACT_PUBLISHER_ID` + affiliate IDs `VITE_{WALMART,TARGET,KROGER,INSTACART,ALBERTSONS,THRIVE}_{CAMPAIGN,AD}_ID` (`services/groceryCheckoutService.ts`)

### E2. Stale vars still in `.env.example` (MEDIUM)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe removed (README L3: "Stripe and PayPal have been removed"); zero references in ts/tsx/js code.
- `VITE_FIREBASE_FUNCTIONS_URL` — zero code references.

### E3. `vite-env.d.ts` typings incomplete (LOW)
Declares only ~12 vars (Firebase, Gemini, Spoonacular, AdMob test flag, Impact SID/token). Missing OpenRouter, Sentry, USDA, EmailJS, CSE, Unsplash, reCAPTCHA, affiliate IDs — so `import.meta.env.X` on those is untyped.

### E4. Oddity: `VITE_COOLDOWN_MS` read in Cloud Functions (LOW)
`functions/src/inviteMember.ts` reads a `VITE_`-prefixed env var server-side. `VITE_` prefix is a client-bundle convention; misleading in Functions and undocumented in `functions/` or `readme/HOUSEHOLD_INVITATION_SETUP.md`.

## 3. readme/ staleness and gaps

### R1. Stale content (MEDIUM)
- `readme/IMPROVEMENT_SUGGESTIONS.md` (last touched 2026-02-25) still instructs adding `VITE_STRIPE_PUBLISHABLE_KEY` (L496) — contradicts the Play-Billing-only model.
- Most readme/ docs date to Feb-Mar 2026 (`HOUSEHOLD_INVITATION_SETUP`, `RECIPE_DATABASE_SETUP`, `RECIPE_FINDER_INTEGRATION`: 2026-02-13; `DATABASE_ANALYTICS`, `SMART_EXPIRATION_ALERTS`, `WEBSITE_DEPLOYMENT`: 2026-02-25) — predating the v3.0.x wave (nutrition/barcode, currency, IAP verification, functions hardening). Only `OPEN_PRICES_INTEGRATION.md` is current (2026-07-29).

### R2. Missing setup docs for shipped subsystems (MEDIUM)
CLAUDE.md tells contributors to "check readme/ before re-deriving how a subsystem was set up", but there is no readme/ doc for:
- Nutrition + barcode scanning (USDA key signup, Spoonacular UPC flow, zxing native-only constraint) — shipped in bf1f00d.
- Currency conversion (frankfurter.app, supported currencies, 24h cache).
- Google Play Billing / IAP verification (`functions/src/verifyPurchase.ts`, Play Console setup) — README has only a high-level "Integration Plan".
- OpenRouter/Groq AI fallback configuration.

### R3. README.md leads with a stale planning block (LOW)
Lines 1-22 are a pre-implementation "Integration Plan" for Play Billing (naming `@capacitor-community/play-billing`, while the app actually uses `cordova-plugin-purchase` per CLAUDE.md/package.json) sitting **above** the `# Stock & Spoon` title. Should be deleted or folded into a readme/ setup doc; as-is it's the first thing a new contributor reads and it's both done and wrong about the plugin.

## 4. Changelog process (observations)
- Source of truth: `CHANGELOG.md` (manual, `## [X.Y.Z] - YYYY-MM-DD` format) → `generate-changelog.cjs` → generated-but-committed `constants/changelogEntries.ts` (currently dirty in git status — expected, since predev regenerates it). The generated file carries no "DO NOT EDIT" awareness in docs; only the script header explains the flow. Nothing in README/CLAUDE.md tells contributors to edit CHANGELOG.md (not changelogEntries.ts) when adding release notes.
- `sync-release-notes.js` / `publish-version.cjs` roles in the release flow are undocumented outside the `release` skill.

## Suggested fixes (priority order)
1. Correct CLAUDE.md changelog sentence (H1) and add `test:rules` to Commands (H3).
2. Regenerate `.env.example`: add the ~20 missing vars grouped by feature, delete Stripe + Functions URL (E1/E2).
3. Delete or relocate README.md's stale top-of-file Play Billing plan (R3); fix plugin name.
4. Purge Stripe from `IMPROVEMENT_SUGGESTIONS.md` (R1).
5. Add short readme/ docs for nutrition/barcode, currency, and Play Billing setup (R2).
6. Complete `vite-env.d.ts` typings (E3); rename/document `VITE_COOLDOWN_MS` in functions (E4).
7. Clarify member-cap enforcement location in CLAUDE.md (H2).
