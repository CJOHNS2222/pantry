---
name: firecheck
description: Use when checking Firestore data for a specific user or household in Stock & Spoon — usage limits, tier/subscription fields, household membership, subscription plan caps — e.g. "what's this user's tier limit", "check household X membership", "why does user Y only get 2 recipes". Read-only lookups.
---

# Firecheck

Wraps the recurring pattern of inspecting live Firestore state for a
user/household (subscription tier, usage counters, membership) instead of
re-deriving the right MCP calls and collection paths each time.

## Collections (per CLAUDE.md domain model)

- `users/{uid}` — user-scoped doc: tier, `hasSeenTutorial`, `householdId`,
  email, etc.
- `households/{householdId}` — shared household doc + subcollections for
  inventory/shopping/mealplan/recipes when household-scoped
- Usage/limit fields enforced in `services/usageService.ts` against
  defaults in `services/remoteConfigService.ts` (`IN_APP_DEFAULTS`) —
  when a usage-limit question comes up ("why only 2 recipes"), check BOTH
  the live Firestore usage counters AND whether Remote Config in the
  Firebase console has overridden `IN_APP_DEFAULTS` (that's the actual
  historical bug pattern seen in this repo — remote config values
  drifting from documented tier caps).

## Workflow

1. Get the identifier from the user (email, uid, or household name) — ask
   if genuinely ambiguous, don't guess a uid.
2. Use `firestore_get_document` / `firestore_query_collection` (firebase
   MCP) to pull the relevant doc(s) — `users/{uid}` first, then
   `households/{householdId}` if a householdId is present.
3. Cross-reference tier caps: read `services/remoteConfigService.ts`
   `IN_APP_DEFAULTS` for what SHOULD apply, then optionally
   `remoteconfig_get_template` (firebase MCP) to check what's actually
   live — flag any mismatch explicitly, that's usually the actual bug.
4. Report the relevant fields directly — don't dump the whole document
   JSON unless asked; pull out only the fields relevant to the question.

## Common mistakes

- Only checking Firestore and missing a Remote Config override — this has
  caused real production discrepancies in this app (premium caps silently
  cut down via remote config, not code)
- Dumping full raw documents into the response instead of the 3-4
  relevant fields
