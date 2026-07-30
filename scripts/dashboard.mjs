// scripts/dashboard.mjs
// CLI: npm run dashboard [-- --json | --done <id> | --no-open]
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { collect } from './dashboard/collect.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const dashDir = path.join(root, '.claude', 'dashboard');
const outPath = path.join(dashDir, 'dashboard.html');

if (args[0] === '--done') {
  const id = args[1];
  const statePath = path.join(dashDir, 'state.json');
  let state = { manualStamps: {} };
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* fresh state */ }
  const data = collect(root, new Date().toISOString());
  const valid = data.routines.map((r) => r.id);
  if (!id || !valid.includes(id)) {
    console.error(`Unknown routine id "${id ?? ''}". Valid ids: ${valid.join(', ')}`);
    process.exit(1);
  }
  state.manualStamps[id] = new Date().toISOString();
  fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(`Stamped ${id} at ${state.manualStamps[id]}`);
}

const data = collect(root, new Date().toISOString());

if (args.includes('--json')) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const { renderHtml } = await import('./dashboard/render.mjs').catch(() => ({ renderHtml: (d) => `<pre>${JSON.stringify(d, null, 2)}</pre>` }));
fs.mkdirSync(dashDir, { recursive: true });
fs.writeFileSync(outPath, renderHtml(data));
console.log(`Wrote ${outPath}`);

if (!args.includes('--no-open') && !args.includes('--done')) {
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', outPath]);
  else if (process.platform === 'darwin') execFile('open', [outPath]);
  else execFile('xdg-open', [outPath]);
}
