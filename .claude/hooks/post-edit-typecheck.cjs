// PostToolUse hook (Write|Edit): scoped type-check feedback.
// Reads hook JSON from stdin, and if the touched file is .ts/.tsx, runs the
// project's full type-check (TS has no reliable per-file mode that respects
// project references) but filters output down to lines mentioning the
// touched file, so only relevant errors reach the model.
const { execSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const filePath = input?.tool_input?.file_path || input?.tool_response?.filePath;
  if (!filePath || !/\.(ts|tsx)$/.test(filePath)) process.exit(0);

  const base = path.basename(filePath);
  let output = '';
  try {
    execSync('npm run type-check', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
    process.exit(0); // clean compile, nothing to report
  } catch (err) {
    output = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
  }

  const relevant = output
    .split('\n')
    .filter((line) => line.includes(base))
    .join('\n')
    .trim();

  if (!relevant) process.exit(0); // errors exist, but none in the touched file

  process.stderr.write(`Type errors in ${base}:\n${relevant}\n`);
  process.exit(2); // signals asyncRewake to surface this to the model
});
