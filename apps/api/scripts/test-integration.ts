import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const databaseUrl = 'postgresql://anhhoa_test:anhhoa_test@localhost:55432/anhhoa_test?schema=public';
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseUrl) throw new Error('test:integration only permits the dedicated Docker Compose PostgreSQL database.');
const composeFile = resolve(import.meta.dirname, '../../../docker-compose.test.yml');

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  run('docker', ['compose', '-f', composeFile, 'down', '-v']);
  run('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait']);
  run('pnpm', ['prisma', 'generate']);
  run('pnpm', ['prisma', 'migrate', 'deploy']);
  run('pnpm', ['vitest', 'run', '--config', 'vitest.integration.config.ts']);
} finally {
  run('docker', ['compose', '-f', composeFile, 'down', '-v']);
}
