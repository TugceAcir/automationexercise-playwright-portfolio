import assert from 'node:assert/strict';
import test from 'node:test';
import { collectFailures, githubAnnotation, renderMarkdown, verdict } from '../../scripts/failure-triage';
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
                results: [{ status: 'failed', duration: 20, error: { message: 'This website is under heavy load (queue full)' } }]
              },
              {
                projectName: 'mobile',
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

  assert.equal(failures.length, 2);
  assert.equal(failures[0].browser, 'firefox');
  assert.equal(failures[0].status, 'failed');
  assert.equal(failures[0].causeGroup, 'other');
  assert.match(failures[0].error, /Firefox-only login failure/);
  assert.equal(failures[1].browser, 'webkit');
  assert.equal(failures[1].causeGroup, 'environment');
});

test('renderMarkdown includes browser metadata for triage', () => {
  const markdown = renderMarkdown(collectFailures(buildCrossBrowserReport()));

  assert.match(markdown, /Browser: firefox/);
  assert.match(markdown, /Confirmed failures: 2 \(1 likely environment, 1 need review\)/);
  assert.match(markdown, /Cause group: environment/);
});

function buildOutageReport(secondError: string): PlaywrightJsonReport {
  return {
    suites: [
      {
        title: 'checkout.spec.ts',
        file: 'tests/e2e/checkout.spec.ts',
        specs: [
          {
            title: '@CHECKOUT011 @checkout @session checkout page survives browser back navigation from payment',
            file: 'tests/e2e/checkout.spec.ts',
            tests: [
              {
                projectName: 'chromium',
                results: [
                  {
                    status: 'failed',
                    error: { message: 'Automation Exercise returned a transient server/load error page.' },
                    annotations: [{ type: 'demo-site-5xx', description: '503:20' }]
                  },
                  {
                    status: 'failed',
                    error: { message: secondError },
                    annotations: [
                      { type: 'issue', description: 'unrelated annotation' },
                      { type: 'demo-site-5xx', description: '503:8,520:1' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

test('collectFailures sums demo-site 5xx counts across every attempt', () => {
  const [failure] = collectFailures(buildOutageReport('Automation Exercise returned a transient server/load error page.'));

  assert.deepEqual(failure.serverErrors, { '503': 28, '520': 1 });
  assert.match(renderMarkdown([failure]), /Demo-site 5xx responses: 29 \(503 x28, 520 x1\)/);
});

test('a run whose failures all match outage signatures is reported as the demo site, with its 5xx evidence', () => {
  const failures = collectFailures(buildOutageReport('Automation Exercise returned a transient server/load error page.'));
  const result = verdict(failures);

  assert.equal(result.level, 'warning');
  assert.equal(result.title, 'Demo site unavailable');
  assert.match(result.message, /No product or test-code failure was detected/);
  assert.match(result.message, /29 \(503 x28, 520 x1\) HTTP 5xx responses/);
  assert.match(renderMarkdown(failures), /^\*\*Demo site unavailable\.\*\*/m);
});

test('5xx evidence never turns an unrecognised failure into an environment one', () => {
  const failures = collectFailures(buildOutageReport("expect(locator).toHaveText(expected) failed"));
  const result = verdict(failures);

  assert.equal(result.level, 'error');
  assert.equal(result.title, 'Failures need review');
  assert.match(result.message, /\[chromium\]/);
});

test('githubAnnotation is a single-line workflow command', () => {
  const annotation = githubAnnotation(collectFailures(buildCrossBrowserReport()));

  assert.ok(annotation);
  assert.match(annotation, /^::error title=Failures need review::/);
  assert.doesNotMatch(annotation, /\n/);
  assert.equal(githubAnnotation([]), undefined);
});
