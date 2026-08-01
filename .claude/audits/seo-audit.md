# SEO Audit — Stock & Spoon (2026-07-31)

Scope: app shell `index.html` (deployed to `ornate-compass-478504-e1.web.app` from `dist/`), marketing site `website/` (deployed to `stock-spoon-website.web.app`), `public/manifest.webmanifest`, robots/sitemap, structured data. Context: the app is an auth-gated, tab-based SPA with no router — organic SEO for app content is largely infeasible and should live on the marketing site; findings are graded accordingly.

---

## HIGH

### H1. App canonical/OG URLs point at a different site than the one serving the page
`index.html:16,20,27` — the app (served at `ornate-compass-478504-e1.web.app`) declares `canonical`, `og:url`, `twitter:url` as `https://stock-spoon-website.web.app/`. A cross-domain canonical to the marketing homepage tells Google "this page IS the marketing homepage", which is false and can confuse indexing of both properties.
**Fix (pick one):**
- Preferred: the app is auth-gated and shouldn't be indexed at all. Replace canonical/OG-url with the app's own URL and add `<meta name="robots" content="noindex, nofollow">` to `index.html`, plus a `public/robots.txt` `Disallow: /`. Keep OG/Twitter tags (they still render nicely when the app URL is shared) but with the correct `og:url`.
- Alternative: if you want app links to consolidate to the marketing site, keep the canonical but understand the app itself then never ranks.

### H2. App has no `robots` meta and permissive `public/robots.txt`
`public/robots.txt` is `Allow: /` with no `Sitemap:` line, on a site whose every route rewrites to a login-gated JS shell (`firebase.json` hosting rewrite `** -> /index.html`). Crawlers index an empty shell under the wrong canonical (see H1).
**Fix:** in `public/robots.txt`:
```
User-agent: *
Disallow: /
```
(or keep Allow + `noindex` meta if you prefer the app URL to still resolve in Search Console).

### H3. `og:image` / `twitter:image` is a square app icon used with `summary_large_image`
`index.html:23,30` and `website/index.html:31,40` point at `icons/stockspoon-icon.png` (an app icon). `summary_large_image` expects ~1200x630 (min 300x157); a square icon renders cropped/letterboxed on X, Facebook, Slack, iMessage.
**Fix:** create a real 1200x630 share image (e.g. `website/icons/og-image.png` — app screenshot + logo + tagline), reference it from both sites, and add:
```html
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Stock & Spoon pantry and meal planning app">
```
Note: `website/firebase.json` headers serve PNGs with `max-age=31536000,immutable` — use a new filename when replacing the image or shares will show the stale cached one.

## MEDIUM

### M1. Twitter tags use `property=` instead of `name=`
Both `index.html:26-30` and `website/index.html:36-40` use `<meta property="twitter:...">`. Twitter/X's parser documents `name=`; many validators flag `property=` and some scrapers miss it (they may fall back to OG, but `twitter:card` itself has no OG fallback).
**Fix:** change all `twitter:*` metas to `name="twitter:..."`. Optionally add `<meta name="twitter:site" content="@yourhandle">` if an account exists.

### M2. Invalid `impact-site-verification` meta
`index.html:6` and `website/index.html:6` use `value='...'` — the HTML attribute is `content=`. If Impact's verifier actually reads `content`, verification silently fails; either way it's invalid HTML.
**Fix:** `<meta name="impact-site-verification" content="4b90de89-a590-4b90-8ab8-1aa26daa68d9">` in both files.

### M3. Manifest icon metadata is wrong / dedicated icons unused
`public/manifest.webmanifest` declares four entries all pointing at `icons/icon.png` while claiming sizes `192x192` and `512x512` — the same file cannot be both, so declared sizes are false (Lighthouse PWA/installability flags this; maskable purpose sharing the `any` art also risks cropped glyphs). Correctly sized `public/icons/icon192.png` and `icon512.png` exist but are referenced nowhere.
**Fix:**
```json
"icons": [
  { "src": "icons/icon192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "icons/icon512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "icons/icon512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```
(Ideally generate a true maskable variant with safe-zone padding.) Also add `"description"`, `"id": "/"`, and optionally `"categories": ["food", "lifestyle"]` and `"screenshots"` for richer install UI.

### M4. Static `document.title` never changes across tabs
No `document.title` writes anywhere in `components/`, `hooks/`, `services/`, `utils/`. Every tab (Pantry, Shopping List, Meal Planner, Recipes, Settings) shows "Stock & Spoon". Not a crawl issue (auth-gated), but it hurts multi-tab UX, browser history, and PWA task-switcher labels.
**Feasible without a router:** in `App.tsx` `switchTab()` (which already tracks analytics + back-stack), add a `useEffect` mapping `Tab` enum → `document.title = `${tabLabel} · Stock & Spoon``. Optionally mirror the tab into `location.hash`/`history.replaceState` for shareable deep links — no react-router needed.

### M5. Marketing-site SPA rewrite makes every URL "exist"
`firebase.json` `stock-spoon-website` hosting also rewrites `** -> /index.html`, so `/anything-at-all` returns 200 with the homepage — soft-404s that dilute crawl and can index garbage URLs. The site is static multi-page (`index.html`, `privacy.html`, `terms.html`, `contact.html`); it doesn't need a SPA rewrite.
**Fix:** delete the `rewrites` block for the `stock-spoon-website` hosting target (Firebase then serves real 404s), or add `"cleanUrls": true` instead if you want extensionless URLs (then update sitemap/canonicals to match).

## LOW

### L1. No structured data in the app; marketing JSON-LD only on homepage
`website/index.html:47+` has a good `SoftwareApplication` JSON-LD; `privacy.html`/`terms.html` have none (fine), and the app has none (fine — auth-gated). Opportunity: if recipe pages are ever exposed publicly, `Recipe` schema (`name`, `recipeIngredient`, `recipeInstructions`, `nutrition`) is the highest-value rich-result type for this product. Not feasible today with the routerless auth-gated SPA — would require public share pages (e.g. a Cloud Function or prerendered `website/` pages). Log as future work only.

### L2. Google Fonts loaded via CSS `@import` in inline `<style>`
`index.html:38` — `@import` serializes discovery (HTML → inline CSS parse → fonts CSS → font files), delaying FCP/LCP, which feeds Core Web Vitals.
**Fix:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### L3. `user-scalable=no` in viewport
`index.html:5` — flagged by Lighthouse accessibility (indirect SEO signal) and ignored by iOS Safari anyway. Acceptable trade-off for an app-like feel, but consider `maximum-scale=5` and dropping `user-scalable=no` for the web deployment.

### L4. `apple-mobile-web-app-capable` without `apple-mobile-web-app-title`
`index.html:11-12` — add `<meta name="apple-mobile-web-app-title" content="StockSpoon">` so iOS home-screen installs get the short name.

### L5. Sitemap hygiene (marketing site)
`website/sitemap.xml` is correct and referenced from `website/robots.txt`. Keep `lastmod` honest when pages change (it's the only field Google actually uses; `changefreq`/`priority` are ignored — harmless to keep). If M5's rewrite fix or `cleanUrls` changes URL shapes, update `<loc>` values and canonicals together.

### L6. Import map to `aistudiocdn.com` in app `index.html`
`index.html:129-139` — a leftover AI Studio import map loads React from a third-party CDN. Vite bundles these deps anyway; if the import map wins for any module you get duplicate React from an external origin (perf + reliability, and it forces the wide `script-src` CSP entry). Verify the production bundle doesn't rely on it and remove the block plus `https://aistudiocdn.com` from the CSP.

---

## What's fine / already good
- Marketing site (`website/index.html`): proper title, description, keywords, robots meta, canonical, `og:site_name`/`og:locale`, Google site verification, `SoftwareApplication` JSON-LD, robots.txt + sitemap.xml. Best SEO investment stays here, not in the app shell.
- `lang="en"`, charset, theme-color present in both.
- App `<title>`/description exist and are sensible as defaults.

## Priority order
1. H1 + H2 together: decide index-vs-noindex for the app origin, fix canonical/og:url, tighten `public/robots.txt`.
2. H3: real 1200x630 OG image for both sites (new filename due to immutable caching).
3. M1/M2: mechanical meta-attribute fixes (both `index.html` and `website/*.html`).
4. M3: manifest icon correction (use existing icon192/icon512).
5. M4: per-tab `document.title` in `switchTab()`.
6. M5: drop marketing-site SPA rewrite.
