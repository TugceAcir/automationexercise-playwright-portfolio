import { defineConfig } from '@playwright/test';
import { resolveBaseUrl } from './src/base-url';

// One non-browser project, one worker, no Playwright retries. The transport retries a
// confirmed transient failure once, for retry-safe reads only, so a retry is always a decision
// the code made and recorded, never a silent rerun that hides a flaky contract.
export default defineConfig({
  testDir: './tests/api',
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  outputDir: 'results/test-artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['html', { outputFolder: 'results/html', open: 'never' }]
  ],
  use: {
    baseURL: resolveBaseUrl()
  },
  projects: [
    {
      name: 'api'
    }
  ]
});
