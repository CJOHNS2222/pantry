---
agent: seo-auditor
status: warn
findings: 7
---

# SEO Audit — Stock & Spoon

## Summary
Two Firebase Hosting sites exist (`firebase.json`): `stock-spoon-website` → `website/` (marketing site, well-optimized: title/description/canonical/OG/Twitter/JSON-LD structured data present on `index.html`, `privacy.html`, `terms.html`, `contact.html`) and `ornate-compass-478504-e1` → `dist/` (the actual React SPA, built from root `index.html`). The SPA shell has no SEO metadata at all, and the app's `public/` folder (which Vite copies verbatim into `dist/`, i.e. publicly served on the app domain) contains two orphaned, unlinked marketing pages (`public/index.html`, `public/landing.html`) with structured metadata that all points to a domain (`smartpantrychef.com`) the app does not actually own/serve, plus broken image references. No `robots.txt` exists for the app hosting site. `website/sitemap.xml` is missing `<lastmod>` and omits pages under 3 of 4 legal/marketing routes' images/OG richness checks are fine, but sitemap coverage is incomplete relative to actual site pages.

## Findings

1. **[Medium]** `index.html:1-128` (root, built into `dist/index.html`, served at the app's public hosting domain) — No `<meta name="description">`, no Open Graph (`og:title`/`og:description`/`og:image`/`og:url`), no Twitter card tags, and no canonical `<link>`. Any link to the live app pasted into Slack/iMessage/Twitter/etc. (e.g. household invite links) renders with no preview text/image. Remediation: add a description meta, `og:*`/`twitter:*` tags with a real preview image, and a canonical URL for the app's production hosting domain.

2. **[Medium]** `public/index.html:1-24` and `public/landing.html:1-24` (both copied verbatim by Vite into `dist/`, so both are live and publicly crawlable at `https://ornate-compass-478504-e1.web.app/index.html`-shadow-risk and `.../landing.html`) — Both declare `og:url`, `twitter:url`, and `og:image`/`twitter:image` pointing at `https://smartpantrychef.com/...`, a domain not referenced anywhere else in the project (actual domains are `stock-spoon-website.web.app` and `ornate-compass-478504-e1.web.app`). These are stale/orphaned duplicates of the real marketing page with no in-app route linking to them. Remediation: delete both dead files from `public/` (the real marketing site lives in `website/`), or if `landing.html` is intentionally kept as a pre-auth splash page, fix its canonical/OG domain and wire it into the actual routing.

3. **[Low]** `public/landing.html:453-468` — Screenshot `<img>` tags reference `/images/pantry.png`, `/images/meal-planner.png`, `/images/recipe-finder.png`, `/images/shopping-list.png`, none of which exist in `public/images/` (that directory only has ingredient icon SVGs/WEBPs, e.g. `apple.svg`, `beef.webp` — no app-screenshot PNGs). All four primary images 404; `onerror` fallbacks (`/images/pasta.webp`, `/images/steak.webp`, `/images/bread.webp`) are themselves unrelated ingredient photos, so the page renders broken/mismatched imagery if ever crawled or linked. Remediation: remove the file (see finding 2) or fix the image paths.

4. **[Low]** `public/landing.html:389,393` and internal links (`href="/app"`, `href="/privacy"`, `href="/terms"`, `href="/contact"`) — these routes don't exist in the SPA (no router; `App.tsx` is a tab-based shell) or on this hosting site, so every nav/footer/CTA link on the page 404s. Reinforces that the file is a dead orphan that should not be reachable in production.

5. **[Low]** No `robots.txt` for the `ornate-compass-478504-e1` hosting site (only `website/robots.txt` exists, scoped to the marketing site). Public web crawlers hitting the live app domain have no crawl directives; combined with finding 1 (no canonical/description) this risks low-quality/duplicate SPA shell pages or the orphaned `landing.html`/`index.html` under `public/` (finding 2) getting indexed under the wrong app domain. Remediation: add a minimal `public/robots.txt` for the app site, e.g. disallow indexing entirely (`Disallow: /`) since it's an authenticated app, or explicitly allow only intended public routes.

6. **[Low]** `website/sitemap.xml:1-23` — No `<lastmod>` element on any `<url>` entry (only `changefreq`/`priority`), reducing crawl-scheduling signal quality for search engines. Also does not list any icon/image sitemap entries despite `og:image` usage. Remediation: add `<lastmod>` dates (can be generated at deploy time) to each URL.

7. **[Info]** `website/index.html:50-90` — Good structured data coverage (`SoftwareApplication`, `Organization`, `WebSite` JSON-LD) but the `SoftwareApplication.offers` block declares `"price": "0"` unconditionally even though `CLAUDE.md` describes tiered premium/family subscriptions — search engines/rich-result consumers may surface "Free" for an app with paid tiers. Remediation: either omit `offers` or reflect the actual freemium tier structure (e.g. `AggregateOffer` with a price range) to avoid a misleading rich-result badge.

## Metrics
- Hosting sites analyzed: 2 (`stock-spoon-website`, `ornate-compass-478504-e1`)
- Public-facing HTML files audited: `index.html` (root/app), `public/index.html`, `public/landing.html`, `public/privacy-policy.html`, `public/delete-account.html`, `website/index.html`, `website/privacy.html`, `website/terms.html`, `website/contact.html`
- Pages with complete meta description + OG + Twitter + canonical: 4 (`website/index.html`, `website/privacy.html`, `website/terms.html`, `website/contact.html`)
- Pages with zero SEO metadata: 1 (app shell `index.html`)
- Orphaned pages with metadata pointing to an unowned domain: 2 (`public/index.html`, `public/landing.html`)
- Sitemap URL count: 4 (missing `<lastmod>` on all)
- robots.txt files present: 1 of 2 hosting sites (`website/robots.txt` only)
