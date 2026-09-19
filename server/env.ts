import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// npm starts the server from server/, but configuration lives at the repo root.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (process.env.NODE_ENV !== 'test' && existsSync(envPath)) process.loadEnvFile(envPath);
