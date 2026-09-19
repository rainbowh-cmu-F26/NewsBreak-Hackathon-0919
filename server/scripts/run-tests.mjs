import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Expand test paths ourselves so discovery does not depend on shell glob support.
function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
const tests = findTests(join(serverDirectory, 'test')).sort();
if (tests.length === 0) {
  console.error('No server test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  '--import', 'tsx', '--test', ...process.argv.slice(2), ...tests,
], {
  cwd: serverDirectory,
  env: { ...process.env, NODE_ENV: 'test', AGENT_MODE: 'local', AI_PROVIDER: 'openai' },
  stdio: 'inherit',
});

if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
