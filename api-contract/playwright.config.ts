import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { resolveBaseUrl } from './src/base-url';
import { SUITE_TEST_DIRS, resolveSuite, suiteResultsDir } from './src/suite';

// One non-browser project per suite, one worker, no Playwright retries. The transport retries a
// confirmed transient read once; writes are never repeated without proof (src/write-proof.ts).
//
// Only the selected suite's project exists in a given run, so a bare `npx playwright test` can
// only ever run the read-only suite, and each suite writes to its own results folder. Select a
// suite with `npm run test:api` (read) or `npm run test:lifecycle`.
const suite = resolveSuite();
const resultsDir = suiteResultsDir(suite);

export default defineConfig({
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  outputDir: path.join(resultsDir, 'test-artifacts'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(resultsDir, 'results.json') }],
    ['html', { outputFolder: path.join(resultsDir, 'html'), open: 'never' }]
  ],
  use: {
    baseURL: resolveBaseUrl()
  },
  projects: [
    {
      name: suite,
      testDir: SUITE_TEST_DIRS[suite]
    }
  ]
});
