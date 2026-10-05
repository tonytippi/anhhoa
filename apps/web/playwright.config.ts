import { defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

const testEnv = loadDotenv({ path: resolve(import.meta.dirname, '../../.env.test'), override: true });

if (testEnv.error || !process.env.E2E_DATABASE_URL) {
  throw new Error('E2E_DATABASE_URL must be defined in the root .env.test.');
}

const port = (name: 'E2E_API_PORT' | 'E2E_APP_PORT' | 'E2E_PARENT_APP_PORT' | 'E2E_TEACHER_APP_PORT' | 'E2E_OPS_APP_PORT', fallback: string) => {
  const value = process.env[name] ?? fallback;
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) {
    throw new Error(`${name} must be a decimal port between 1 and 65535.`);
  }
  return value;
};
const apiPort = port('E2E_API_PORT', '3000');
const appPort = port('E2E_APP_PORT', '5173');
const parentAppPort = port('E2E_PARENT_APP_PORT', '5174');
const teacherAppPort = port('E2E_TEACHER_APP_PORT', '5175');
const opsAppPort = port('E2E_OPS_APP_PORT', '5176');
const configuredPorts = [apiPort, appPort, parentAppPort, teacherAppPort, opsAppPort];
if (new Set(configuredPorts).size !== configuredPorts.length) throw new Error('Every E2E portal port must be distinct.');

const e2eEnvironment = [
  `NODE_ENV=test`,
  `DATABASE_URL=${JSON.stringify(process.env.E2E_DATABASE_URL)}`,
  `APP_WEB_ORIGIN=http://localhost:${appPort}`,
  `PARENT_WEB_ORIGIN=http://localhost:${parentAppPort}`,
  `TEACHER_WEB_ORIGIN=http://localhost:${teacherAppPort}`,
  `OPS_WEB_ORIGIN=http://localhost:${opsAppPort}`,
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
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/teacher-web build && pnpm --filter @passionedu/teacher-web exec vite preview --host localhost --port ${teacherAppPort}`, port: Number(teacherAppPort), reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port ${parentAppPort}`, port: Number(parentAppPort), reuseExistingServer: false },
    { command: `VITE_API_URL=http://localhost:${apiPort} pnpm --filter @passionedu/ops-web build && pnpm --filter @passionedu/ops-web exec vite preview --host localhost --port ${opsAppPort}`, port: Number(opsAppPort), reuseExistingServer: false },
  ],
  use: { baseURL: `http://localhost:${appPort}`, serviceWorkers: 'block' },
});
