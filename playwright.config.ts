import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end walkthrough of the demo script against a production build.
 * Build first (`npm run build`), or use `npm run test:e2e`, which builds and then runs.
 * The server runs in SEED mode with the mock AI engine: synthetic data only, no keys, no network.
 */
const PORT = Number(process.env.E2E_PORT ?? 3300);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one in-memory seed store, so the walkthrough runs in order
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_MODE: "seed",
      AI_ENGINE: "mock",
      EVIDENCE_EMBEDDINGS: "off", // lexical search: no model download in CI
      // Test-only values for this throwaway server (never the real ones in .env.local).
      REVIEWER_ACCESS_CODE: "e2e-reviewer-code",
      SESSION_SECRET: "e2e-session-secret-for-tests-only-0123456789",
    },
  },
});
