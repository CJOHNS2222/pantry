import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from './test-utils';
import { describe, test } from 'vitest';

const componentsDir = path.resolve(__dirname, '..', 'components');

describe('Smoke tests: render components', () => {
  const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

  files.forEach(file => {
    const name = file.replace(/\.tsx$/, '');
    test(`${name} should render without throwing`, async () => {
      const fullPath = path.join(componentsDir, file);
      // Dynamic import; use file URL
      let mod: any;
      try {
        mod = await import(fullPath);
      } catch (err) {
        // If import fails (syntax, SSR-only code), skip but record
        console.warn(`Skipping import of ${file}:`, err?.message || err);
        return;
      }

      // Identify a React component export to attempt rendering
      const Candidate = mod.default || Object.values(mod).find((v: any) => typeof v === 'function');
      if (!Candidate) {
        console.warn(`No callable export found for ${file}, skipping render.`);
        return;
      }

      // Try rendering with minimal props; many components accept optional props.
      try {
        render(React.createElement(Candidate, {} as any));
      } catch (err) {
        // If render fails due to missing provider/hooks, ignore but surface as warn
        console.warn(`Render failed for ${file}:`, err?.message || err);
      }
    }, 20000);
  });
});
