import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: [
    { command: 'SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api prisma:migrate:deploy && SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api seed:e2e:release-gate && SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api e2e:api', port: 3000, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm build && pnpm exec vite preview --host localhost --port 5173', port: 5173, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/teacher-web build && pnpm --filter @passionedu/teacher-web exec vite preview --host localhost --port 5175', port: 5175, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port 5174', port: 5174, reuseExistingServer: false },
    { command: 'VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web build && pnpm --filter @passionedu/ops-web exec vite preview --host localhost --port 5176', port: 5176, reuseExistingServer: false },
  ],
  use: { baseURL: 'http://localhost:5173', serviceWorkers: 'block' },
});
