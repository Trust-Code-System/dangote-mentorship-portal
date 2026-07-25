import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the seeded demo cohort (CLAUDE.md §2: one happy-path
// E2E per milestone). Requires a running Postgres with migrations + seed
// applied. Run: `npm run test:e2e`.
//
// Locally we use the dev server for fast iteration. In CI we serve a production
// build (`next build` runs as its own step first, then `next start` here) so
// there is no on-demand compile — that avoids the first-request compile blowing
// the per-test timeout under `next dev`.
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: isCI ? 1 : 0,
  // Keep production-server load deterministic. The public WebGL experience
  // plus database-backed auth routes can overwhelm `next start` when
  // Playwright derives a higher worker count from a large runner.
  workers: isCI ? 1 : undefined,
  use: {
    // Port 3001 matches AUTH_URL in .env (3000 is commonly taken on dev boxes).
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: isCI ? 'npm run start -- -p 3001' : 'npm run dev -- -p 3001',
    url: 'http://localhost:3001',
    env: {
      AUTH_URL: 'http://localhost:3001',
      AUTH_TRUST_HOST: 'true',
    },
    // Reuse a server you already have running locally; in CI always start fresh.
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
