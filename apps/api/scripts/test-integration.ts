import { spawnSync } from 'node:child_process';

if (!process.env.TARGET_INTEGRATION_DATABASE_URL) {
  throw new Error('TARGET_INTEGRATION_DATABASE_URL must point to an empty PostgreSQL target database.');
}

const database = process.env.TARGET_INTEGRATION_DATABASE_URL;
const migrationEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database };
const seedEnv = { ...process.env, NODE_ENV: 'development', DATABASE_URL: database, PRISMA_SEED: 'true' };
const testEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database };
for (const [args, env] of [
  [['exec', 'prisma', 'migrate', 'deploy'], migrationEnv],
  [['exec', 'prisma', 'db', 'seed'], seedEnv],
  [['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts'], testEnv],
] as const) {
  if (spawnSync('pnpm', args, { stdio: 'inherit', env }).status !== 0) process.exitCode = 1;
}
