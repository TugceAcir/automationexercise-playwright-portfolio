import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: [
    ['list'],
    ['./scripts/business-playwright-reporter.ts'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://automationexercise.com',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // The public demo site may serve mixed external content; this is intentional for portfolio UI tests.
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      // Chromium-only keeps the portfolio CI focused and stable before expanding to cross-browser coverage.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
