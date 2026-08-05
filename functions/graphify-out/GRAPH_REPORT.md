# Graph Report - functions  (2026-08-03)

## Corpus Check
- 21 files · ~10,731 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 136 nodes · 169 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `115dfebe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- dailyReminders.ts
- devDependencies
- scripts
- compilerOptions
- subscriptionNotifications.ts
- dependencies
- inviteMember.ts
- resetUsageLimits.ts
- eslint.config.js

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 11 edges
2. `scripts` - 9 edges
3. `getExpiringItems()` - 7 edges
4. `buildDailyDigest()` - 5 edges
5. `resolveSubscriptionState()` - 4 edges
6. `inviteMemberCore()` - 4 edges
7. `getTodaysMealNames()` - 3 edges
8. `runDailyReminders()` - 3 edges
9. `PRODUCT_TIER_MAP` - 3 edges
10. `assertNotInCooldown()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.09
Nodes (16): acceptInvitation, checkInvitation, deleteAccount, retryPendingAccountDeletions, Merchant, TRACKING_DOMAINS, wrapImpactTrackingUrl, leaveHousehold (+8 more)

### Community 1 - "dailyReminders.ts"
Cohesion: 0.15
Nodes (20): appendNotifications(), buildDailyDigest(), computeExpirationDate(), db, DEFAULT_SETTINGS, ExpirySetting, FOOD_RISK_CATEGORIES, getExpiringItems() (+12 more)

### Community 2 - "devDependencies"
Cohesion: 0.13
Nodes (15): eslint, @eslint/js, firebase-functions-test, globals, devDependencies, eslint, @eslint/js, firebase-functions-test (+7 more)

### Community 3 - "scripts"
Cohesion: 0.13
Nodes (14): engines, node, main, name, private, scripts, build, build:watch (+6 more)

### Community 4 - "compilerOptions"
Cohesion: 0.13
Nodes (14): src, compileOnSave, compilerOptions, esModuleInterop, module, moduleResolution, noImplicitReturns, noUnusedLocals (+6 more)

### Community 5 - "subscriptionNotifications.ts"
Cohesion: 0.22
Nodes (10): getAndroidPublisher(), PRODUCT_TIER_MAP, ResolvedSubscriptionState, resolveSubscriptionState(), ACTIONABLE_TYPES, handlePlaySubscriptionNotification, IMMEDIATE_DOWNGRADE_TYPES, NotificationType (+2 more)

### Community 6 - "dependencies"
Cohesion: 0.22
Nodes (9): firebase-admin, firebase-functions, googleapis, nodemailer, dependencies, firebase-admin, firebase-functions, googleapis (+1 more)

### Community 7 - "inviteMember.ts"
Cohesion: 0.33
Nodes (8): assertCallerNotRateLimited(), assertNotInCooldown(), emailToDocId(), inviteMember, inviteMemberCore(), isValidEmail(), NOTE: we intentionally do NOT add memberIdToStore to householdData.memberIds, NOTE: the `inviteMemberHttp` GET/POST HTTP fallback wrapper that used to live

### Community 8 - "resetUsageLimits.ts"
Cohesion: 0.40
Nodes (5): db, FREE_TIER_DEFAULTS, getWeekStart(), performUsageReset(), resetWeeklyUsageLimits

## Knowledge Gaps
- **56 isolated node(s):** `globals`, `tseslint`, `name`, `lint`, `build` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `globals`, `tseslint`, `name` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09359605911330049 - nodes in this community are weakly interconnected._
- **Should `dailyReminders.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._