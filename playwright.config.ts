import { defineConfig, devices } from '@playwright/test';

function resolveWorkerCount(): number {
  const fallback = process.env.CI ? 2 : 1;
  const configuredWorkers = Number(process.env.WORKERS);

  return Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : fallback;
}

function resolveRetryCount(): number {
  const configuredRetries = Number(process.env.RETRIES);

  return Number.isFinite(configuredRetries) && configuredRetries >= 0 ? configuredRetries : process.env.CI ? 2 : 0;
}

const workerCount = resolveWorkerCount();
const retryCount = resolveRetryCount();

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: retryCount,
  workers: workerCount,
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
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    // The public demo site may serve mixed external content; this is intentional for portfolio UI tests.
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
