import { spawnSync } from 'node:child_process';
import 'dotenv/config';
import { assertDevelopmentEnvironment } from './development-environment.js';

assertDevelopmentEnvironment('Development database reset');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to reset the development database.');
}

for (const args of [
  ['exec', 'prisma', 'migrate', 'reset', '--force'],
  ['exec', 'prisma', 'db', 'seed'],
]) {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, PRISMA_SEED: 'true' },
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
