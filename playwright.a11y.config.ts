import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/accessibility',
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  outputDir: 'accessibility-results/test-artifacts',
  reporter: [
    ['list'],
    ['./scripts/accessibility-playwright-reporter.ts'],
    ['html', { outputFolder: 'accessibility-results/html', open: 'never' }]
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://automationexercise.com',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'accessibility-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
