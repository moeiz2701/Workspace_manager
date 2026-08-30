import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * e2e runs against the LOCAL Supabase stack (`pnpm db:start`) with the §8.4
 * dev-login flag on — Google OAuth cannot be driven from a browser test.
 *
 * The global setup resets the database and seeds a known fixture, so the suite
 * is deterministic and safe to re-run.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'pnpm build && pnpm start --port 3100',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_DEV_LOGIN: 'true',
    },
  },
});
