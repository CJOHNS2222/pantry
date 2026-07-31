import { defineConfig } from 'vitest/config';

// Separate Vitest config for Firestore/Storage security-rules tests.
//
// These tests exercise the real rules engine via the Firebase emulator
// (@firebase/rules-unit-testing) and must run in a plain Node environment
// with none of `src/test/setup.ts`'s global `firebase/firestore` mocks
// loaded - those mocks are only meant for jsdom component/service tests
// and would shadow the real SDK calls the rules tests depend on.
//
// Run via `npm run test:rules`, which expects the Firestore + Storage
// emulators to already be running (see `firebase emulators:exec` in CI,
// or `firebase emulators:start` locally).
export default defineConfig({
  test: {
    include: ['src/test/rules/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'functions/**', 'functions/**/node_modules/**'],
    environment: 'node',
    setupFiles: [],
    watch: false,
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
