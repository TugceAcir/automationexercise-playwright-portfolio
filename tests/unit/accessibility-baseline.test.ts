import assert from 'node:assert/strict';
import test from 'node:test';
import { compareRuleIds } from '../accessibility/baseline-policy';

test('accessibility baseline comparison identifies new state-specific rule IDs', () => {
  const comparison = compareRuleIds(['button-name', 'color-contrast', 'label'], ['button-name', 'color-contrast']);

  assert.deepEqual(comparison.newRuleIds, ['label']);
  assert.deepEqual(comparison.removedRuleIds, []);
});

test('accessibility baseline comparison reports resolved rules separately without treating them as new', () => {
  const comparison = compareRuleIds(['color-contrast'], ['button-name', 'color-contrast']);

  assert.deepEqual(comparison.newRuleIds, []);
  assert.deepEqual(comparison.removedRuleIds, ['button-name']);
});
