import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAccessibilitySummary, type AccessibilityStateResult } from '../../scripts/accessibility-report-model';
import { accessibilityExecutiveSummary, readAccessibilitySummary, renderAccessibilityPanel } from '../../scripts/business-report/accessibility';

function buildState(overrides: Partial<AccessibilityStateResult> = {}): AccessibilityStateResult {
  return {
    caseId: 'A11Y001',
    title: 'home page',
    tags: ['@A11Y001', '@accessibility', '@wcag21aa', '@regression'],
    state: 'home',
    status: 'passed',
    currentRuleIds: ['button-name', 'color-contrast'],
    newRuleIds: [],
    removedRuleIds: [],
    durationMs: 100,
    ...overrides
  };
}

test('accessibility summary counts passed, regression, and unavailable states independently', () => {
  const summary = buildAccessibilitySummary({
    engine: 'axe-core test',
    generatedAt: '2026-07-01T00:00:00.000Z',
    states: [
      buildState(),
      buildState({ caseId: 'A11Y002', status: 'regression', newRuleIds: ['label'] }),
      buildState({ caseId: 'A11Y003', status: 'unavailable', currentRuleIds: [], error: 'setup failed' })
    ]
  });

  assert.equal(summary.totalStates, 3);
  assert.equal(summary.passedStates, 1);
  assert.equal(summary.regressionStates, 1);
  assert.equal(summary.unavailableStates, 1);
});

test('accessibility panel renders taxonomy, known findings, regressions, and resolved warnings', () => {
  const summary = buildAccessibilitySummary({
    engine: 'axe-core test',
    generatedAt: '2026-07-01T00:00:00.000Z',
    states: [buildState({ newRuleIds: ['label'], removedRuleIds: ['link-name'], status: 'regression' })]
  });
  const html = renderAccessibilityPanel(summary);

  assert.match(html, /A11Y001/);
  assert.match(html, /@wcag21aa/);
  assert.match(html, /button-name, color-contrast/);
  assert.match(html, /label/);
  assert.match(html, /link-name/);
  assert.match(html, /do not establish complete WCAG conformance|does not establish complete WCAG conformance/);
});

test('accessibility report handles missing and malformed summaries without throwing', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'a11y-report-'));
  const missing = path.join(directory, 'missing.json');
  const malformed = path.join(directory, 'malformed.json');
  writeFileSync(malformed, '{not-json', 'utf8');

  assert.equal(readAccessibilitySummary(missing), undefined);
  assert.equal(readAccessibilitySummary(malformed), undefined);
  assert.match(renderAccessibilityPanel(undefined), /Results unavailable/);
  assert.deepEqual(accessibilityExecutiveSummary(undefined), ['Accessibility: results unavailable']);
});
