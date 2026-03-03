import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  include: ['src/**/__tests__/**', 'src/**/?(*.)+(spec|test).[tj]s?(x)', 'components/**/__tests__/**'],
    exclude: ['e2e/**', 'node_modules/**', 'functions/**', 'functions/**/node_modules/**'],
    environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  watch: false
  }
});
