import { defineConfig } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

const testEnv = loadDotenv({ path: resolve(import.meta.dirname, "../../.env.test"), override: true });
if (testEnv.error || !process.env.E2E_DATABASE_URL)
  throw new Error("E2E_DATABASE_URL must be defined in the root .env.test.");

const environment = [
  "NODE_ENV=test",
  `DATABASE_URL=${JSON.stringify(process.env.E2E_DATABASE_URL)}`,
  "APP_WEB_ORIGIN=http://localhost:5173",
  "PARENT_WEB_ORIGIN=http://localhost:5174",
  "TEACHER_WEB_ORIGIN=http://localhost:5175",
  "OPS_WEB_ORIGIN=http://localhost:5176",
  "SESSION_SECRET=test-session-secret-must-be-at-least-32-characters",
  "GOOGLE_CLIENT_ID=passionedu-e2e-client",
  "GOOGLE_CLIENT_SECRET=passionedu-e2e-secret",
].join(" ");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://localhost:5174", serviceWorkers: "allow" },
  webServer: [
    { command: `${environment} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api prisma:migrate:deploy && ${environment} SUPERADMIN_EMAIL=release-gate-operator@example.com pnpm --filter @passionedu/api seed:e2e:release-gate && ${environment} COLLECTION_RUN_GENERATION_WORKER=true pnpm --filter @passionedu/api e2e:api`, port: 3000, reuseExistingServer: false },
    { command: "VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/parent-web build && pnpm --filter @passionedu/parent-web exec vite preview --host localhost --port 5174", port: 5174, reuseExistingServer: false },
  ],
});
