import { defineConfig } from '@playwright/test';

// Screenshots for the Hướng dẫn: center.spec.ts retakes public/guides/tt-*.jpg from the synthetic
// "Trung tâm Anh ngữ Hoa Mai" (apps/api/scripts/seed-guide-demo-center.ts) and preschool.spec.ts the preschool images from
// "Trường Mầm non Hoa Mai" (seed-guide-demo-preschool.ts); both seeds rebuild their School in the E2E database.
// Each script reseeds its demo School itself. Start the API and this portal on the E2E ports first, with the root .env.test loaded:
//   API (apps/api, after pnpm build): NODE_ENV=test DATABASE_URL=$E2E_DATABASE_URL PORT=$E2E_API_PORT APP_WEB_ORIGIN=http://localhost:$E2E_APP_PORT
//     APP_OAUTH_REDIRECT_URLS=http://localhost:$E2E_APP_PORT SESSION_SECRET=<32+ chars> GOOGLE_CLIENT_ID=passionedu-e2e-client
//     GOOGLE_CLIENT_SECRET=passionedu-e2e-secret COLLECTION_RUN_GENERATION_WORKER=true node dist/e2e-api.js
//   Portal (apps/web): VITE_API_URL=http://localhost:$E2E_API_PORT pnpm exec vite --port $E2E_APP_PORT
// then, from apps/web with .env.test loaded: pnpm exec playwright test -c playwright.guides.config.ts [center|preschool]
export default defineConfig({
  testDir: './guide-screenshots',
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 10_000 },
  use: { actionTimeout: 15_000, baseURL: `http://localhost:${process.env.E2E_APP_PORT ?? '6002'}`, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
});
