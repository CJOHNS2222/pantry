import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';

// Rules-unit-testing exercises the real `firestore.rules` file against the
// Firestore emulator. Run via `npm run test:rules`, which expects the
// emulator to already be listening (see `firebase emulators:exec` in CI,
// or `firebase emulators:start` locally). Not part of the default `npm
// test` run - see `vitest.rules.config.ts`.
const PROJECT_ID = 'demo-stockandspoon-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

describe('firestore.rules — household scoping', () => {
  const householdAId = 'household-a';
  const memberA = 'user-a';
  const outsider = 'user-outsider';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`households/${householdAId}`).set({
        memberIds: [memberA],
        members: [{ uid: memberA }]
      });
      await db.doc(`households/${householdAId}/cache/inventory`).set({ items: [] });
    });
  });

  it('allows a household member to read their household document', async () => {
    const memberCtx = testEnv.authenticatedContext(memberA);
    await assertSucceeds(memberCtx.firestore().doc(`households/${householdAId}`).get());
  });

  it('denies a non-member from reading another household\'s document', async () => {
    const outsiderCtx = testEnv.authenticatedContext(outsider);
    await assertFails(outsiderCtx.firestore().doc(`households/${householdAId}`).get());
  });

  it('denies an unauthenticated client from reading a household document', async () => {
    const anonCtx = testEnv.unauthenticatedContext();
    await assertFails(anonCtx.firestore().doc(`households/${householdAId}`).get());
  });

  it('allows a member to read/write their household\'s subcollection docs', async () => {
    const memberCtx = testEnv.authenticatedContext(memberA);
    const cacheRef = memberCtx.firestore().doc(`households/${householdAId}/cache/inventory`);
    await assertSucceeds(cacheRef.get());
    await assertSucceeds(cacheRef.set({ items: ['milk'] }));
  });

  it('denies a non-member from reading another household\'s subcollection doc', async () => {
    const outsiderCtx = testEnv.authenticatedContext(outsider);
    await assertFails(outsiderCtx.firestore().doc(`households/${householdAId}/cache/inventory`).get());
  });

  it('denies a non-member from writing to another household\'s subcollection', async () => {
    const outsiderCtx = testEnv.authenticatedContext(outsider);
    await assertFails(
      outsiderCtx.firestore().doc(`households/${householdAId}/cache/inventory`).set({ items: ['hacked'] })
    );
  });
});

describe('firestore.rules — per-user document scoping', () => {
  const userA = 'user-a';
  const userB = 'user-b';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${userA}/cache/savedRecipes`).set({
        recipes: [],
        lastUpdated: Date.now()
      });
    });
  });

  it('allows a user to read their own user-scoped document', async () => {
    const ctx = testEnv.authenticatedContext(userA);
    await assertSucceeds(ctx.firestore().doc(`users/${userA}/cache/savedRecipes`).get());
  });

  it('denies another user from reading someone else\'s user-scoped document', async () => {
    const ctx = testEnv.authenticatedContext(userB);
    await assertFails(ctx.firestore().doc(`users/${userA}/cache/savedRecipes`).get());
  });

  it('denies another user from writing to someone else\'s user-scoped document', async () => {
    const ctx = testEnv.authenticatedContext(userB);
    await assertFails(
      ctx.firestore().doc(`users/${userA}/cache/savedRecipes`).set({ recipes: ['hacked'], lastUpdated: Date.now() })
    );
  });
});
