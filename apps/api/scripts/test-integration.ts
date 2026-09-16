import { spawnSync } from 'node:child_process';

if (!process.env.TARGET_INTEGRATION_DATABASE_URL) {
  throw new Error('TARGET_INTEGRATION_DATABASE_URL must point to an empty PostgreSQL target database.');
}

const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: process.env.TARGET_INTEGRATION_DATABASE_URL, ALLOW_DEVELOPMENT_SEED: 'true', PRISMA_SEED: 'true' };
for (const args of [['exec', 'prisma', 'migrate', 'deploy'], ['exec', 'prisma', 'db', 'seed'], ['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts']]) {
  if (spawnSync('pnpm', args, { stdio: 'inherit', env }).status !== 0) process.exitCode = 1;
}
