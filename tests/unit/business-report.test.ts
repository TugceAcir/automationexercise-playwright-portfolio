import assert from 'node:assert/strict';
import test from 'node:test';
import { flattenScenarios } from '../../scripts/business-report/core';
import { gherkinForScenario } from '../../scripts/business-report/gherkin-templates';
import { cleanTitle, extractTags, featureFromFile, isScenarioIdTag, scenarioIdForScenario, type ScenarioResult } from '../../scripts/business-report/report-model';
import { enrichScenarios } from '../../scripts/business-report/scenario-enrichment';
import { calculateConfidenceScore, scenarioStatusGroup, summarizeRun } from '../../scripts/business-report/scoring';

// These tests guard the logic that builds the business report so the dashboard
// stays accurate. They run before the report is generated (see the
// `business-report` npm script and the CI workflow).

function buildScenario(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    title: 'Cart > shopper can add multiple products to the cart',
    feature: 'Cart',
    status: 'passed',
    durationMs: 1200,
    attempts: 1,
    tags: ['@CART001', '@cart', '@regression'],
    browser: 'chromium',
    file: 'tests/e2e/cart.spec.ts',
    ...overrides
  };
}

test('confidence score is the pass rate when every scenario passes', () => {
  assert.equal(calculateConfidenceScore(10, 10, 0, 0), 100);
});

test('confidence score subtracts 12 per failure and 4 per skip', () => {
  // pass rate 70, minus 2 failures (24) minus 1 skip (4) = 42
  assert.equal(calculateConfidenceScore(10, 7, 2, 1), 42);
});

test('confidence score never drops below zero', () => {
  assert.equal(calculateConfidenceScore(5, 0, 5, 0), 0);
});

test('confidence score is zero when there are no scenarios', () => {
  assert.equal(calculateConfidenceScore(0, 0, 0, 0), 0);
});

test('scenario status group separates flaky passes from stable passes', () => {
  assert.equal(scenarioStatusGroup(buildScenario({ status: 'passed', attempts: 1 })), 'passed');
  assert.equal(scenarioStatusGroup(buildScenario({ status: 'passed', attempts: 3 })), 'flaky');
  assert.equal(scenarioStatusGroup(buildScenario({ status: 'failed', attempts: 1 })), 'failed');
  assert.equal(scenarioStatusGroup(buildScenario({ status: 'skipped', attempts: 1 })), 'skipped');
});

test('run summary aggregates counts and a matching confidence score', () => {
  const summary = summarizeRun({ stats: { duration: 5000 } }, [
    buildScenario({ status: 'passed' }),
    buildScenario({ status: 'passed' }),
    buildScenario({ status: 'failed' }),
    buildScenario({ status: 'skipped' })
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.durationMs, 5000);
  assert.equal(summary.confidenceScore, calculateConfidenceScore(4, 2, 1, 1));
});

test('scenario id tags are recognised and normalised', () => {
  assert.equal(isScenarioIdTag('@CART001'), true);
  assert.equal(isScenarioIdTag('@cart'), false);
  assert.equal(isScenarioIdTag('@regression'), false);
  assert.equal(scenarioIdForScenario(buildScenario()), 'CART001');
});

test('title and tag helpers strip annotations cleanly', () => {
  assert.equal(cleanTitle('@CART001 @cart shopper adds   a product'), 'shopper adds a product');
  assert.deepEqual(extractTags('@CART001 @cart text'), ['@CART001', '@cart']);
});

test('feature is derived from the spec file path', () => {
  assert.equal(featureFromFile('tests/e2e/checkout.spec.ts'), 'Checkout');
  assert.equal(featureFromFile('tests/e2e/products.spec.ts'), 'Product Discovery');
  assert.equal(featureFromFile('tests/e2e/unknown.spec.ts'), 'General');
});

test('known scenario ids resolve to a Gherkin Feature/Scenario block', () => {
  const gherkin = gherkinForScenario(buildScenario());
  assert.ok(gherkin?.startsWith('Feature: Cart'));
  assert.ok(gherkin?.includes('Scenario:'));
  assert.ok(gherkin?.includes('Given'));
});

test('enrichScenarios reports no missing templates for a tagged scenario', () => {
  const { scenarios, missingTemplates } = enrichScenarios([buildScenario({ browser: 'firefox' })]);

  assert.equal(missingTemplates.length, 0);
  assert.equal(scenarios[0].statusGroup, 'passed');
  assert.equal(scenarios[0].browser, 'firefox');
  assert.ok(scenarios[0].gherkin.includes('Feature: Cart'));
  assert.ok(scenarios[0].command.includes('--project firefox'));
  assert.ok(scenarios[0].command.includes('--grep'));
  assert.ok(scenarios[0].csvRow.includes('Cart'));
  assert.ok(scenarios[0].csvRow.includes('firefox'));
});

test('enrichScenarios flags a scenario whose id has no template', () => {
  const { missingTemplates } = enrichScenarios([buildScenario({ tags: ['@ZZZ999', '@cart'] })]);

  assert.equal(missingTemplates.length, 1);
  assert.ok(missingTemplates[0].includes('ZZZ999'));
});

test('flattenScenarios creates one scenario per browser project', () => {
  const scenarios = flattenScenarios({
    stats: { duration: 30 },
    suites: [
      {
        title: 'cart.spec.ts',
        file: 'tests/e2e/cart.spec.ts',
        specs: [
          {
            title: '@CART001 @cart shopper can add multiple products to the cart',
            tags: ['@CART001', '@cart'],
            file: 'tests/e2e/cart.spec.ts',
            tests: [
              { projectName: 'chromium', results: [{ status: 'passed', duration: 10 }] },
              { projectName: 'firefox', results: [{ status: 'passed', duration: 20 }] }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(scenarios.length, 2);
  assert.deepEqual(scenarios.map((scenario) => scenario.browser), ['chromium', 'firefox']);
  assert.deepEqual(scenarios.map((scenario) => scenario.durationMs), [10, 20]);
});
