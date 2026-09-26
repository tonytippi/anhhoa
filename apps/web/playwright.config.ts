import { defineConfig } from '@playwright/test';

const e2eDatabase = process.env.E2E_DATABASE_URL ? `DATABASE_URL=${JSON.stringify(process.env.E2E_DATABASE_URL)} ` : '';

export default defineConfig({
  testDir: './e2e',
  // The release fixture is intentionally mutable: Finance issue and Ops suspend
  // exercise the same two Schools, so parallel specs would corrupt each other's proof.
  workers: 1,
  webServer: [
    { command: `${e2eDatabase}SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api prisma:migrate:deploy && ${e2eDatabase}SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api seed:e2e:release-gate && ${e2eDatabase}SUPERADMIN_EMAIL=release-gate-operator@example.com COLLECTION_RUN_GENERATION_WORKER=true pnpm --filter @passionedu/api e2e:api`, port: 3000, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm build && pnpm exec vite preview --host localhost --port 5173', port: 5173, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/teacher-web build && pnpm --filter @passionedu/teacher-web exec vite preview --host localhost --port 5175', port: 5175, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port 5174', port: 5174, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web build && pnpm --filter @passionedu/ops-web exec vite preview --host localhost --port 5176', port: 5176, reuseExistingServer: false },
  ],
  use: { baseURL: 'http://localhost:5173', serviceWorkers: 'block' },
});
