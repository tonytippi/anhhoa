import { spawnSync } from 'node:child_process';
import 'dotenv/config';
import { assertDevelopmentEnvironment } from './development-environment.js';

assertDevelopmentEnvironment('Development database reset');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to reset the development database.');
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force'], {
  stdio: 'inherit',
  // Prisma invokes the configured seed command after applying all migrations.
  env: { ...process.env, PRISMA_SEED: 'true' },
});

if (result.status !== 0) process.exitCode = result.status ?? 1;
