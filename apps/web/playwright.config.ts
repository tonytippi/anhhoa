import { defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

const testEnv = loadDotenv({ path: resolve(import.meta.dirname, '../../.env.test'), override: true });

if (testEnv.error || !process.env.E2E_DATABASE_URL) {
  throw new Error('E2E_DATABASE_URL must be defined in the root .env.test.');
}

const e2eEnvironment = [
  `NODE_ENV=test`,
  `DATABASE_URL=${JSON.stringify(process.env.E2E_DATABASE_URL)}`,
  'APP_WEB_ORIGIN=http://localhost:5173',
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
    { command: `${e2eEnvironment} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api prisma:migrate:deploy && ${e2eEnvironment} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api seed:e2e:release-gate && ${e2eEnvironment} SUPERADMIN_EMAIL=release-gate-operator@example.com COLLECTION_RUN_GENERATION_WORKER=true pnpm --filter @passionedu/api e2e:api`, port: 3000, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm build && pnpm exec vite preview --host localhost --port 5173', port: 5173, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/teacher-web build && pnpm --filter @passionedu/teacher-web exec vite preview --host localhost --port 5175', port: 5175, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port 5174', port: 5174, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web build && pnpm --filter @passionedu/ops-web exec vite preview --host localhost --port 5176', port: 5176, reuseExistingServer: false },
  ],
  use: { baseURL: 'http://localhost:5173', serviceWorkers: 'block' },
});
