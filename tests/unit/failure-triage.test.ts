import assert from 'node:assert/strict';
import test from 'node:test';
import { collectFailures, renderMarkdown } from '../../scripts/failure-triage';
import type { PlaywrightJsonReport } from '../../scripts/types/playwright-json';

function buildCrossBrowserReport(): PlaywrightJsonReport {
  return {
    suites: [
      {
        title: 'checkout.spec.ts',
        file: 'tests/e2e/checkout.spec.ts',
        specs: [
          {
            title: '@CHECKOUT005 @checkout shopper can log in before checkout',
            tags: ['@CHECKOUT005', '@checkout'],
            file: 'tests/e2e/checkout.spec.ts',
            tests: [
              {
                projectName: 'chromium',
                results: [{ status: 'passed', duration: 10 }]
              },
              {
                projectName: 'firefox',
                results: [{ status: 'failed', duration: 20, error: { message: 'Firefox-only login failure' } }]
              },
              {
                projectName: 'webkit',
                results: [{ status: 'passed', duration: 30 }]
              }
            ]
          }
        ]
      }
    ]
  };
}

test('collectFailures includes failures from non-first browser projects', () => {
  const failures = collectFailures(buildCrossBrowserReport());

  assert.equal(failures.length, 1);
  assert.equal(failures[0].browser, 'firefox');
  assert.equal(failures[0].status, 'failed');
  assert.match(failures[0].error, /Firefox-only login failure/);
});

test('renderMarkdown includes browser metadata for triage', () => {
  const markdown = renderMarkdown(collectFailures(buildCrossBrowserReport()));

  assert.match(markdown, /Browser: firefox/);
  assert.match(markdown, /Confirmed failures: 1/);
});
