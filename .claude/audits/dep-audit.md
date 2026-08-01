# Dependency Audit — Stock & Spoon

Date: 2026-07-31 | Auditor: dep-auditor
Scope: `package.json` (root), `functions/package.json`, `npm audit` (both), outdated packages, unused deps, peer conflicts, heavy-dep review.

## Summary

- Root: **12 vulnerabilities (4 high, 8 moderate)**. All 4 highs are removable or auto-fixable; none affect shipped runtime code paths except `fast-uri`.
- Functions: **16 vulnerabilities (6 high, 10 moderate)** — mostly ReDoS in glob/minimatch/picomatch tooling chains; most fixable via `npm audit fix`.
- 3 unused **runtime** dependencies found (`date-fns`, `react-swipeable`, `@opentelemetry/api`) plus `react-router-dom` used only as a test wrapper.
- Confirmed peer-conflict root cause: `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` pins `@capacitor/core ^6.0.0`; project is on Capacitor 8.
- Functions dev toolchain is 2+ majors behind (TS 4.9, ESLint 8, @typescript-eslint 5).

---

## 1. Vulnerabilities — root (`npm audit`, 12 total: 4 high / 8 moderate)

| Severity | Package | Advisory | Path / effect | Recommendation |
|---|---|---|---|---|
| HIGH | `react-router` 7.12.0–8.2.0 | GHSA-qwww-vcr4-c8h2 (RSC CSRF bypass) | via devDep `react-router-dom@7.18.1` | **Remove `react-router-dom` entirely** (see §3). Vuln is RSC/server-mode only — no runtime exposure here, but removal clears both high findings at once. |
| HIGH | `react-router-dom` | same as above | direct devDep | Remove. |
| HIGH | `brace-expansion` (<1.1.17 / <2.1.3 / <5.0.8) | GHSA-mh99-v99m-4gvg (DoS) | transitive: typescript-eslint, glob, google-gax, workbox-build | `npm audit fix` — non-breaking fix available. Tooling-only exposure. |
| HIGH | `fast-uri` 3.0.0–3.1.3 | GHSA-v2hh-gcrm-f6hx (host confusion) | transitive | `npm audit fix` — non-breaking fix available. |
| MOD | `tar` <=7.5.20 | GHSA-r292-9mhp-454m (DoS) | transitive tooling | `npm audit fix`. |
| MOD | `uuid` <11.1.1 chain (`gaxios`, `teeny-request`, `retry-request`, `@google-cloud/storage`, `firebase-admin`, `firebase-functions`) | GHSA-w5hq-g745-h8pq | via root devDeps `firebase-admin@14` / `firebase-functions@7` (used by `scripts/` only) | Only "fix" npm offers is downgrading firebase-admin to 10.3.0 — **do not**; that is a regression. Accept risk (Node-side scripts, low severity, buffer bounds check in uuid v3/v5/v6 with caller-supplied buf — not a pattern used here). Re-check when firebase-admin ships a patched `@google-cloud/storage`. |

Action: run `npm audit fix` (no `--force`) — clears `brace-expansion`, `fast-uri`, `tar`. Never run `--force` here (it would downgrade firebase-admin/functions across majors).

## 2. Vulnerabilities — functions (`npm audit`, 16 total: 6 high / 10 moderate)

| Severity | Package | Advisory | Recommendation |
|---|---|---|---|
| HIGH | `minimatch` (multiple ReDoS: GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | via old glob chains (eslint 8 / TS 4.9 toolchain) | `npm audit fix`; fully resolved by toolchain upgrade (§5). |
| HIGH | `picomatch` <=2.3.1 (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj) | tooling | `npm audit fix`. |
| MOD | `ts-deepmerge` <8 (GHSA-87mf-gv2c-c62c) | via `firebase-functions-test` | Update `firebase-functions-test` to 3.5.0 (`npm update`); ignore npm's suggested 0.3.3 downgrade. |
| MOD | `uuid` chain via `firebase-admin@14` | same as root | Accept; server-side, awaiting upstream. |

## 3. Unused dependencies (removal candidates)

Verified by import search across `components/ hooks/ services/ utils/ contexts/ src/ scripts/ functions/` (graphify + grep):

| Package | Section | Evidence | Recommendation |
|---|---|---|---|
| `date-fns@4` | **dependencies** | Zero imports anywhere | **Remove** (HIGH confidence). ~date logic uses ISO strings + native Date. |
| `react-swipeable@7` | **dependencies** | Zero imports (incl. `useSwipeable`) | **Remove** (HIGH confidence). |
| `@opentelemetry/api@1.9` | **dependencies** | Zero direct imports; only needed transitively by `firebase-admin` (dev/scripts) and `vitest`, both of which resolve it themselves | **Remove from `dependencies`** (it currently ships in the prod dep graph for no reason). |
| `react-router-dom@7.18` | devDependencies | Only `MemoryRouter` in `src/test/test-utils.tsx`, `src/test/smoke-all-components.test.tsx`, `src/test/smoke-all-components-2.test.tsx`; app has no router (CLAUDE.md-confirmed) | **Remove** and replace `MemoryRouter` wrapper with a passthrough `<>{children}</>` (nothing under it uses router context). Also clears both HIGH audit findings in §1. |
| `msw@2` | devDependencies | Zero imports; not in `src/test/setup.ts` | Remove unless intentionally kept for future integration tests (CLAUDE.md says "only reach for it in isolated integration test" — none exist today). LOW priority. |
| `ts-node@10` | devDependencies | Zero imports/usages in scripts (all scripts are `.js`/`.cjs`/`.mjs` run with `node`) | Remove. LOW priority. |
| `puppeteer@25` | devDependencies | Not imported in repo; referenced only by `.mcp.json` MCP server (which bundles its own via npx) | Likely removable (~300 MB Chromium download per install) — verify the puppeteer MCP server doesn't resolve the local install first. MEDIUM priority. |

Note: `firebase-admin` + `firebase-functions` in **root** devDependencies duplicate `functions/` deps but are genuinely used by `scripts/*.js` maintenance scripts — keep, but they are the source of the root uuid-chain audit noise.

Used-and-fine (verified single-use, appropriately loaded): `tesseract.js` (lazy-loaded WASM worker in `services/receiptOcrService.ts` — good), `@zxing/library`, `fuse.js`, `zod`, `react-window`, `@emailjs/browser`, `@google/genai`, `sharp` (scripts only, correctly a devDep).

## 4. Peer conflict — @capacitor-firebase/* vs capacitor-google-auth (HIGH, maintenance risk)

Root cause confirmed from installed manifests:
- `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` → `peerDependencies: { "@capacitor/core": "^6.0.0" }`
- `@capacitor-firebase/analytics@8.x` → `peerDependencies: { "@capacitor/core": ">=8.0.0", "firebase": "^12.6.0" }`

Project is on Capacitor 8, so every `npm install` needs `--legacy-peer-deps`, and the repo already carries a gradle-9 patch for the plugin (commit c5a7d51). The codetrix plugin is effectively unmaintained (latest is an RC from the Capacitor 6 era).

Recommendation (MEDIUM-term): migrate Google sign-in to a Capacitor-8-native plugin — either `@capacitor-firebase/authentication` (matches the `@capacitor-firebase/*` family already used) or `@capgo/capacitor-social-login` (the community-designated successor to codetrix). Removes `--legacy-peer-deps`, the patch-package gradle patch, and the RC-version risk. Until then, keep the documented `--legacy-peer-deps` workflow.

## 5. Outdated packages

Root — mostly current; notable majors available:
| Package | Current | Latest | Note |
|---|---|---|---|
| `react-window` | 1.8.11 | 2.3.0 | Major; v2 has breaking API. Upgrade only with list-component regression pass. |
| `eslint` | 9.39.5 | 10.8.0 | Major; low urgency. |
| `typescript` | 6.0.3 | 7.0.2 | Major; wait for ecosystem (typescript-eslint) support. |
| `jsdom` | 29 | 30 | Test-only, easy bump. |
| `@testing-library/jest-dom` | 6.9.1 | 7.0.0 | Test-only major. |
| minors (`@capacitor/* 8.5`, `firebase 12.17`, `@sentry/react 10.69`, `vite 8.2`, `@google/genai 2.15`, etc.) | — | — | Routine `npm update` batch. |

Functions — **significantly stale toolchain** (MEDIUM):
| Package | Current | Latest |
|---|---|---|
| `typescript` | 4.9.5 | 7.x (target 5.x minimum) |
| `eslint` | 8.57.1 (EOL) | 10.x |
| `@typescript-eslint/*` | 5.62.0 | 8.65.0 |
| `firebase-functions-test` | 3.4.1 | 3.5.0 (fixes ts-deepmerge advisory) |

Runtime deps (`firebase-admin@14`, `firebase-functions@7`, `googleapis@173`, `nodemailer@9`) are current. Upgrading the functions ESLint/TS toolchain also clears most of its 16 audit findings.

## 6. Heavy deps / lighter alternatives

| Package | Weight concern | Verdict |
|---|---|---|
| `tesseract.js` | Multi-MB WASM + traineddata | OK — already lazy-loaded on demand (`receiptOcrService.ts`); no bundle impact. |
| `puppeteer` (dev) | ~300 MB Chromium at install | Redundant with `@playwright/test`; see §3. |
| `date-fns` | ~ | Unused — remove (see §3). |
| `lucide-react@1.23` | Large icon set | Fine if imports are named (tree-shaken by Vite). Spot-check with `npm run build:analyze` if bundle grows. |
| `@zxing/library` | ~300 KB | Acceptable for on-device barcode decode; ensure it stays behind the native-only code path / dynamic import. |
| `googleapis@173` (functions) | Huge meta-package, slow cold starts | If only 1–2 APIs are used (e.g. Android Publisher for IAP verification), switch to the scoped package (`@googleapis/androidpublisher`) — meaningful cold-start win. MEDIUM. |

## 7. Prioritized action list

1. **HIGH** — `npm audit fix` (root, no --force): clears brace-expansion, fast-uri, tar.
2. **HIGH** — Remove `react-router-dom`; swap test `MemoryRouter` for a fragment wrapper (3 files). Clears both remaining HIGH advisories.
3. **HIGH** — Remove unused runtime deps: `date-fns`, `react-swipeable`, `@opentelemetry/api`.
4. **MED** — `cd functions && npm audit fix && npm update firebase-functions-test`; then upgrade functions toolchain (TS ≥5, ESLint 9+, @typescript-eslint 8).
5. **MED** — Plan migration off `@codetrix-studio/capacitor-google-auth` to a Capacitor-8-compatible auth plugin; retire `--legacy-peer-deps` and the gradle patch.
6. **LOW** — Drop `msw`, `ts-node`, (probably) `puppeteer` devDeps; routine minor-version `npm update` batch; consider scoped `@googleapis/*` in functions.
7. **Accepted risk** — uuid/gaxios/@google-cloud/storage moderate chain under firebase-admin@14 (both projects): no sane fix until upstream patches; do NOT take npm's firebase-admin@10 downgrade.
