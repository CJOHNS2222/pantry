---
agent: security-auditor
status: warn
findings: 8
---

# Summary

Reviewed Firestore/Storage security rules, Cloud Functions (invite/leave household, IAP purchase verification), client-side third-party API key handling, and HTML-generation paths. Auth boundaries on the callable Cloud Functions and `verifyPurchase` server-side receipt validation are solid (no client-trusted entitlement grants). Main issues are: an authorization gap in Storage rules (any authenticated user can delete/overwrite other users' recipe assets), an unescaped-HTML injection path in the recipe PDF/print export, an under-validated shared Firestore cache write, an ID token accepted via URL query string, and (architecturally expected but worth flagging) third-party AI/recipe API keys shipped in the client bundle.

# Findings

### 1. [MEDIUM] Storage: no ownership check on recipe photo deletion
`storage.rules:14-23`
```
match /recipe-photos/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null && ...
  allow delete: if request.auth != null;   // any authenticated user, not just the uploader
}
```
Any authenticated user can delete any other user's uploaded recipe/rating photos — there's no `resource.metadata['uploader'] == request.auth.uid` check like the `pantry_images` rule below uses. A malicious or compromised account can mass-delete other users' content.
**Remediation:** require `resource.metadata['uploader'] == request.auth.uid` (or admin) on delete, consistent with the `pantry_images` rule at line 40.

### 2. [MEDIUM] Storage: any authenticated user can overwrite public recipe images at any path
`storage.rules:4-11`
```
match /recipes/{recipeId} {
  allow read: if true;
  allow write: if request.auth != null && size<10MB && contentType matches image/.*;
}
```
No ownership/admin check — any logged-in user can write/overwrite the image at an arbitrary `recipeId`, including recipes they don't own, since these are publicly readable shared assets. Enables defacement of other users'/the app's recipe images.
**Remediation:** restrict writes to the recipe owner (compare against the corresponding Firestore `recipes/{recipeId}.userId`) or to an admin-only ingestion path, or namespace uploads under the uploader's uid.

### 3. [MEDIUM] Stored XSS risk in recipe print/export via unescaped `innerHTML`
`components/recipe-finder/RecipeExportModal.tsx:319-337`
```ts
${list.map(r => `
  <h2>${r.title}</h2>
  ${r.description ? `<p class="description">${r.description}</p>` : ''}
  ...
  ${(r.ingredients || []).map(i => `<li>${i}</li>`).join('')}
  ${(r.instructions || []).map(step => `<li>${step}</li>`).join('')}
`).join('')}
...
printWindow.document.documentElement.innerHTML = html;
```
Recipe `title`/`description`/`ingredients`/`instructions` are interpolated directly into an HTML string with no escaping, then injected via `innerHTML` into a new window. Recipe content can originate from untrusted sources: URL-scraped imports (`services/importService.ts` parses arbitrary site HTML including a raw `<title>` regex extraction) and community/global recipe submissions (`firestore.rules:170-179` lets any authenticated user create a `recipes/{recipeId}` doc with an arbitrary `title` string up to 200 chars, and `recipes/submissions` similarly). A crafted title/ingredient string like `<img src=x onerror=...>` executes in the print-window context when a user exports/prints that recipe.
**Remediation:** HTML-escape all interpolated fields (`&`, `<`, `>`, `"`, `'`) before building the print HTML, or build the DOM via `textContent`/`createElement` instead of string concatenation + `innerHTML`.

### 4. [MEDIUM] Firestore: shared `price_cache` document is fully writable with no validation
`firestore.rules:250-253`
```
match /price_cache/priceData {
  allow read, write: if request.auth != null;
}
```
Unlike `leaderboard_cache/global` (validates that only the caller's own map key changes) or `system/community_rated_recipes` (validates shape/size), this single shared document accepts arbitrary field contents and full overwrite from any authenticated user — no size cap, no key-scoping, no type checks. Any authenticated user can corrupt or bloat the global price cache for all users, or overwrite others' contributed data.
**Remediation:** scope writes to the caller's own key(s) within the document (mirroring the `leaderboard_cache` pattern) and validate the written shape/size.

### 5. [LOW] ID token accepted via URL query string
`functions/src/inviteMember.ts:182`
```ts
const idToken = (authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]
  : (typeof req.query?.idToken === 'string' ? req.query.idToken : undefined));
```
`inviteMemberHttp` (the CORS/dev-fallback HTTP variant of `inviteMember`) accepts the Firebase ID token as a `?idToken=` query parameter. Tokens in URLs are commonly captured in server access logs, proxy logs, browser history, and Referer headers, extending the token's exposure well beyond the request itself.
**Remediation:** drop the query-string fallback; require the `Authorization: Bearer` header only.

### 6. [LOW] Permissive reflected-origin CORS with credentials on an HTTP function
`functions/src/inviteMember.ts:173-174`
```ts
res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
res.set('Access-Control-Allow-Credentials', 'true');
```
Reflects any request `Origin` back while also allowing credentials — a standard CORS anti-pattern. Actual exploitability here is reduced because auth is via a Bearer token the calling page must already possess/attach (not an ambient cookie), but this still needlessly widens the trust boundary vs. an explicit origin allowlist.
**Remediation:** allowlist known origins (web app domain, `capacitor://localhost`, dev `localhost`) instead of reflecting `Origin` unconditionally.

### 7. [LOW] Storage: pantry image reads not scoped to household/owner despite stated intent
`storage.rules:31-34`
```
// Require authenticated reads for pantry images to protect personal photos
match /pantry_images/{allPaths=**} {
  allow read: if request.auth != null;
```
The comment implies these are meant to be protected personal photos, but the read rule only checks that the requester is *some* authenticated user of the app, not that they belong to the household/user that owns the item. Anyone with an account who obtains/guesses a `pantry_images/{path}` (e.g. via shared links, logs, cache leakage) can view another household's pantry photos.
**Remediation:** encode the owning `userId`/`householdId` in the storage path and check it against `request.auth.uid` / household membership, matching the Firestore household-scoping pattern used elsewhere.

### 8. [INFO] Third-party AI/recipe API keys are shipped in the client bundle
`services/geminiService.ts:28`, `services/openRouterService.ts:112,202`, `services/spoonacularRecipeClient.ts:4`
```ts
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
import.meta.env?.VITE_SPOONACULAR_API_KEY || process.env.VITE_SPOONACULAR_API_KEY
```
Because these use the `VITE_` prefix, Vite inlines them into the built client bundle, so the Gemini, OpenRouter/Groq, and Spoonacular API keys are readable by anyone who inspects the shipped JS or network requests. This lets an attacker extract and reuse the keys directly against the upstream providers, bypassing the app's own tier/usage-limit enforcement (`usageService.ts`) entirely and running up the project owner's bill/quota. This is an architectural tradeoff already implicit in the codebase (client-side AI calls), so flagging as informational rather than a hard fail, but recommend proxying these calls through a Cloud Function (as is already done for IAP verification and household mutations) so keys stay server-side and usage limits are enforced authoritatively rather than only client-side.

# Metrics

- Files/areas reviewed: `firestore.rules`, `storage.rules`, `functions/src/verifyPurchase.ts`, `functions/src/inviteMember.ts` (incl. `inviteMemberHttp`), `functions/src/leaveHousehold.ts`, `functions/src/checkInvitation.ts`, `scripts/decrypt-keys.cjs`, `VITE_firebaseConfig.ts`, `services/geminiService.ts`, `services/openRouterService.ts`, `services/spoonacularRecipeClient.ts`, `components/recipe-finder/RecipeExportModal.tsx`, `.gitignore` secret-file exclusions.
- No hardcoded secrets, private keys (`*.pem`), or encrypted key material (`*.enc`) found tracked in git history for this repo (`.gitignore` correctly excludes `.env`, `.env.*`, `*.pem`, `*.enc`, keystore/keyid files).
- `verifyPurchase` correctly performs server-side receipt verification against the Android Publisher API and never trusts client-supplied entitlement data — no findings there.
- Findings by severity: Medium 4, Low 3, Info 1.
