import { afterAll, afterEach, beforeEach, beforeAll, describe, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';

// Exercises the real `storage.rules` file against the Storage emulator.
// Run via `npm run test:rules` with the emulator already running (see
// `firebase emulators:exec` in CI). Not part of the default `npm test` run
// - see `vitest.rules.config.ts`.
//
// Note: `storage.rules` currently allows any authenticated user to write
// `recipes/{recipeId}` and delete anything under `recipe-photos/**` with no
// ownership check (tracked separately as FIXES.md F16, not yet landed at
// the time this suite was written). This suite intentionally only asserts
// against the ownership checks that actually exist today
// (`users/{userId}/**` and `pantry_images/**`); it does not assert on the
// currently-open `recipes`/`recipe-photos` paths so it won't need rewriting
// the moment F16 lands - add coverage for those paths then.
const PROJECT_ID = 'demo-stockandspoon-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../../storage.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearStorage();
});

describe('storage.rules — users/{userId} scoping', () => {
  const userA = 'user-a';
  const userB = 'user-b';

  it('allows a user to write to their own users/{uid} path', async () => {
    const ctx = testEnv.authenticatedContext(userA);
    const fileRef = ctx.storage().ref(`users/${userA}/avatar.png`);
    await assertSucceeds(fileRef.put(new Uint8Array([1, 2, 3])));
  });

  it('denies a user from writing to another user\'s users/{uid} path', async () => {
    const ctx = testEnv.authenticatedContext(userB);
    const fileRef = ctx.storage().ref(`users/${userA}/avatar.png`);
    await assertFails(fileRef.put(new Uint8Array([1, 2, 3])));
  });

  it('denies a user from reading another user\'s users/{uid} path', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.storage().ref(`users/${userA}/avatar.png`).put(new Uint8Array([1, 2, 3]));
    });
    const ctx = testEnv.authenticatedContext(userB);
    await assertFails(ctx.storage().ref(`users/${userA}/avatar.png`).getDownloadURL());
  });
});

describe('storage.rules — pantry_images ownership', () => {
  const uploader = 'user-uploader';
  const otherUser = 'user-other';
  const imagePath = 'pantry_images/item-123.jpg';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .storage()
        .ref(imagePath)
        .put(new Uint8Array([1, 2, 3]), {
          contentType: 'image/jpeg',
          customMetadata: { uploader }
        });
    });
  });

  it('allows the uploader to delete their own pantry image', async () => {
    const ctx = testEnv.authenticatedContext(uploader);
    await assertSucceeds(ctx.storage().ref(imagePath).delete());
  });

  it('denies another authenticated user from deleting someone else\'s pantry image', async () => {
    const ctx = testEnv.authenticatedContext(otherUser);
    await assertFails(ctx.storage().ref(imagePath).delete());
  });

  it('denies uploading a pantry image with someone else\'s uploader metadata', async () => {
    const ctx = testEnv.authenticatedContext(otherUser);
    await assertFails(
      ctx
        .storage()
        .ref('pantry_images/spoofed.jpg')
        .put(new Uint8Array([1, 2, 3]), {
          contentType: 'image/jpeg',
          customMetadata: { uploader }
        })
    );
  });

  it('denies an unauthenticated client from writing a new pantry image', async () => {
    const anonCtx = testEnv.unauthenticatedContext();
    await assertFails(
      anonCtx
        .storage()
        .ref('pantry_images/anon-upload.jpg')
        .put(new Uint8Array([1, 2, 3]), {
          contentType: 'image/jpeg',
          customMetadata: { uploader: 'anon' }
        })
    );
  });
});
