import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests against `npm run dev` with seeded data (`npm run seed`).
 * Dev mode signs in the dev user automatically, so tests start logged in.
 */
export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    reuseExistingServer: true,
    url: 'http://localhost:3000',
    timeout: 120_000,
  },
})
