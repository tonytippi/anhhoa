import { defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

const testEnv = loadDotenv({ path: resolve(import.meta.dirname, '../../.env.test'), override: true });

if (testEnv.error || !process.env.E2E_DATABASE_URL) {
  throw new Error('E2E_DATABASE_URL must be defined in the root .env.test.');
}

const port = (name: 'E2E_API_PORT' | 'E2E_APP_PORT', fallback: string) => {
  const value = process.env[name] ?? fallback;
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) {
    throw new Error(`${name} must be a decimal port between 1 and 65535.`);
  }
  return value;
};
const apiPort = port('E2E_API_PORT', '3000');
const appPort = port('E2E_APP_PORT', '5173');
if (apiPort === appPort) throw new Error('E2E_API_PORT and E2E_APP_PORT must be distinct.');
if (['5174', '5175', '5176'].includes(apiPort) || ['5174', '5175', '5176'].includes(appPort)) {
  throw new Error('E2E_API_PORT and E2E_APP_PORT must not collide with fixed portal ports.');
}

const e2eEnvironment = [
  `NODE_ENV=test`,
  `DATABASE_URL=${JSON.stringify(process.env.E2E_DATABASE_URL)}`,
  `APP_WEB_ORIGIN=http://localhost:${appPort}`,
  'PARENT_WEB_ORIGIN=http://localhost:5174',
  'TEACHER_WEB_ORIGIN=http://localhost:5175',
  'OPS_WEB_ORIGIN=http://localhost:5176',
  'SESSION_SECRET=test-session-secret-must-be-at-least-32-characters',
  'GOOGLE_CLIENT_ID=passionedu-e2e-client',
  'GOOGLE_CLIENT_SECRET=passionedu-e2e-secret',
].join(' ');

export default defineConfig({
  testDir: './e2e',
  // The release fixture is intentionally mutable: Finance issue and Ops suspend
  // exercise the same two Schools, so parallel specs would corrupt each other's proof.
  workers: 1,
  webServer: [
    { command: `${e2eEnvironment} PORT=${apiPort} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api prisma:migrate:deploy && ${e2eEnvironment} PORT=${apiPort} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api seed:e2e:release-gate && ${e2eEnvironment} PORT=${apiPort} SUPERADMIN_EMAIL=release-gate-operator@example.com COLLECTION_RUN_GENERATION_WORKER=true pnpm --filter @passionedu/api e2e:api`, port: Number(apiPort), reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm build && pnpm exec vite preview --host localhost --port ${appPort}`, port: Number(appPort), reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/teacher-web build && pnpm --filter @passionedu/teacher-web exec vite preview --host localhost --port 5175`, port: 5175, reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port 5174`, port: 5174, reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/ops-web build && pnpm --filter @passionedu/ops-web exec vite preview --host localhost --port 5176`, port: 5176, reuseExistingServer: false },
  ],
  use: { baseURL: `http://localhost:${appPort}`, serviceWorkers: 'block' },
});
