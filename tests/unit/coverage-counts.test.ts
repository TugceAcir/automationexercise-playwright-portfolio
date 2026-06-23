import assert from 'node:assert/strict';
import test from 'node:test';
import { countE2eCoverage, renderCoverageBlock } from '../../scripts/coverage-counts';

test('coverage counts derive scenario totals from e2e specs', () => {
  const summary = countE2eCoverage();

  assert.equal(summary.browserProjects, 3);
  assert.equal(summary.browserScenarioExecutions, summary.totalScenarios * summary.browserProjects);
  assert.ok(summary.totalScenarios > 0);
  assert.ok(summary.suites.some((suite) => suite.name === 'Checkout' && suite.tests > 0));
});

test('coverage block renders generated totals and suite rows', () => {
  const block = renderCoverageBlock({
    browserProjects: 3,
    browserScenarioExecutions: 6,
    totalScenarios: 2,
    suites: [{ file: 'sample.spec.ts', name: 'Sample', tests: 2 }]
  });

  assert.match(block, /2 scenarios/);
  assert.match(block, /6 browser-scenario executions/);
  assert.match(block, /\| Sample \| 2 \|/);
});
