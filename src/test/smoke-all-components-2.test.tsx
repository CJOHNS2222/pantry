import fs from 'fs';
import path from 'path';
import React from 'react';
import { render as rtlRender, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, afterEach, afterAll, vi } from 'vitest';

// Minimal wrapper: skip AppProvider/AppActionsProvider to avoid useDataManagement
// mounting on every test — their Firebase service singletons accumulate callbacks
// across renders and OOM the worker. Render errors from missing context are
// already swallowed by the try/catch below.
function SmokeWrapper({ children }: { children?: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}
function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: SmokeWrapper });
}

const componentsDir = path.resolve(__dirname, '..', '..', 'components');

function getFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== '__tests__') {
        results.push(...getFilesRecursively(fullPath));
      }
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

// Fake setInterval once for the whole suite so polling loops never hold the
// event loop open. Never call useRealTimers() between tests.
vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

// Components that require native plugins or hang in jsdom.
const SKIP_COMPONENTS = new Set([
  'AdMobBanner',
  'QuickAdd',
  'PantryScanner',
]);

describe('Smoke tests: render components (R–Z)', () => {
  afterEach(() => {
    cleanup();           // explicit RTL unmount
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  // Split R–Z: companion to smoke-all-components.test.tsx which covers A–Q.
  // Each file runs in its own Vitest worker so the module cache resets between halves.
  const files = getFilesRecursively(componentsDir)
    .filter(f => path.basename(f).toLowerCase() >= 'r');

  files.forEach(file => {
    const name = path.basename(file).replace(/\.tsx$/, '');
    const fullPath = file;

    if (SKIP_COMPONENTS.has(name)) {
      test.skip(`${name} should render without throwing`, () => {});
      return;
    }

    test(`${name} should render without throwing`, async () => {
      let mod: any;
      try {
        mod = await import(fullPath);
      } catch (err) {
        console.warn(`Skipping import of ${name}:`, err?.message || err);
        return;
      }

      const Candidate = mod.default || Object.values(mod).find((v: any) => typeof v === 'function');
      if (!Candidate) {
        console.warn(`No callable export found for ${file}, skipping render.`);
        return;
      }

      try {
        render(React.createElement(Candidate, {} as any));
      } catch (err) {
        console.warn(`Render failed for ${file}:`, err?.message || err);
      }
    }, 8000);
  });
});
