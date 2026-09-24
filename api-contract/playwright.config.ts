import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { resolveBaseUrl } from './src/base-url';
import { SUITE_TEST_DIRS, resolveSuite, suiteResultsDir } from './src/suite';

// One non-browser project per suite, one worker, no Playwright retries. The transport retries a
// confirmed transient read once; writes are never repeated without proof (src/write-proof.ts).
//
// Only the selected suite's project is instantiated, so a run can never mix the two, and each
// suite writes to its own results folder. With no API_SUITE set, a bare `npx playwright test`
// runs the read suite; scripts/run-suite.ts sets API_SUITE explicitly for `npm run test:api`
// and `npm run test:lifecycle`. Forcing API_SUITE=lifecycle by hand still creates nothing: the
// fixture refuses to run without the API_RUN_ID that run-suite.ts mints, because cleanup
// evidence that cannot be tied to a run is worthless.
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
