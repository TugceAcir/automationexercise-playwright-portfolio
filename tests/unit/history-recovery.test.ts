import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORY_LIMIT, mergeHistories, parseHistoryPayload } from '../../scripts/business-report/history-recovery';
import type { RunSummary } from '../../scripts/business-report/report-model';

// history.json is gitignored and survives only in the Actions cache and the published
// dashboard. These tests guard the recovery rules that decide whether the trend
// survives a cache miss - a wrong answer here silently resets a published number.

function buildRun(id: string, overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id,
    generatedAt: id.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z'),
    total: 210,
    passed: 210,
    failed: 0,
    environmentFailed: 0,
    skipped: 0,
    flaky: 0,
    durationMs: 1000,
    confidenceScore: 100,
    scope: 'full-regression',
    scenarios: [],
    ...overrides
  };
}

const runA = buildRun('2026-08-01T10-00-00-000Z');
const runB = buildRun('2026-08-02T10-00-00-000Z');
const runC = buildRun('2026-08-03T10-00-00-000Z');

test('mergeHistories unions rows the two sources do not share', () => {
  const merged = mergeHistories([runC], [runA, runB]);

  assert.deepEqual(merged.map((run) => run.id), [runA.id, runB.id, runC.id]);
});

test('mergeHistories recovers published rows a cache miss would have lost', () => {
  const merged = mergeHistories([], [runA, runB]);

  assert.equal(merged.length, 2);
});

test('mergeHistories keeps a cached row the published copy never received', () => {
  // The real 2026-09-03 case: a scheduled run writes to the cache but does not publish.
  const merged = mergeHistories([runA, runB, runC], [runA, runB]);

  assert.deepEqual(merged.map((run) => run.id), [runA.id, runB.id, runC.id]);
});

test('mergeHistories does not duplicate a run both sources hold', () => {
  const merged = mergeHistories([runA, runB], [runA, runB]);

  assert.deepEqual(merged.map((run) => run.id), [runA.id, runB.id]);
});

test('mergeHistories keeps the copy that still carries scenarios', () => {
  // Every row but the newest is stripped on write, so only one copy can hold them
  // and it is the one readLatestSavedRun needs.
  const stripped = buildRun(runA.id, { scenarios: [] });
  const withScenarios = buildRun(runA.id, {
    scenarios: [
      {
        title: 'Cart > shopper can add a product',
        feature: 'Cart',
        status: 'passed',
        durationMs: 10,
        attempts: 1,
        tags: ['@CART001'],
        browser: 'chromium'
      }
    ]
  });

  assert.equal(mergeHistories([stripped], [withScenarios])[0].scenarios.length, 1);
  assert.equal(mergeHistories([withScenarios], [stripped])[0].scenarios.length, 1);
});

test('mergeHistories orders rows oldest first regardless of input order', () => {
  const merged = mergeHistories([runC, runA], [runB]);

  assert.deepEqual(merged.map((run) => run.id), [runA.id, runB.id, runC.id]);
});

test('mergeHistories caps the result at the same limit appendHistory applies', () => {
  const many = Array.from({ length: HISTORY_LIMIT + 12 }, (_, index) =>
    buildRun(`2026-08-01T10-00-00-${String(index).padStart(3, '0')}Z`));

  const merged = mergeHistories(many.slice(20), many.slice(0, 20));

  assert.equal(merged.length, HISTORY_LIMIT);
  // Capping must drop the OLDEST rows, never the newest.
  assert.equal(merged.at(-1)?.id, many.at(-1)?.id);
});

test('parseHistoryPayload accepts a real history file', () => {
  const rows = parseHistoryPayload(JSON.stringify([runA, runB]));

  assert.equal(rows?.length, 2);
});

test('parseHistoryPayload accepts rows recorded before flaky and scope existed', () => {
  const legacy = { ...buildRun(runA.id) } as Partial<RunSummary>;
  delete legacy.flaky;
  delete legacy.scope;

  assert.equal(parseHistoryPayload(JSON.stringify([legacy]))?.length, 1);
});

test('parseHistoryPayload distinguishes an empty history from an unreadable one', () => {
  // "No runs recorded" and "not a history file" are different claims and the caller
  // branches on the difference, so an empty array must survive as an empty array.
  assert.deepEqual(parseHistoryPayload('[]'), []);
  assert.equal(parseHistoryPayload('nonsense'), undefined);
});

test('parseHistoryPayload rejects an error page served with a 200', () => {
  assert.equal(parseHistoryPayload('<!DOCTYPE html><html><body>404</body></html>'), undefined);
});

test('parseHistoryPayload rejects JSON that is not a list of runs', () => {
  assert.equal(parseHistoryPayload('{"rows":[]}'), undefined);
  assert.equal(parseHistoryPayload('null'), undefined);
});

test('parseHistoryPayload rejects a list whose rows are not runs', () => {
  const missingCounts = { id: runA.id, generatedAt: runA.generatedAt };
  const unparseableDate = { ...buildRun(runA.id), generatedAt: 'not-a-date' };
  const negativeCount = { ...buildRun(runA.id), passed: -1 };

  assert.equal(parseHistoryPayload(JSON.stringify([missingCounts])), undefined);
  assert.equal(parseHistoryPayload(JSON.stringify([unparseableDate])), undefined);
  assert.equal(parseHistoryPayload(JSON.stringify([negativeCount])), undefined);
  assert.equal(parseHistoryPayload(JSON.stringify([runA, 'not a row'])), undefined);
});
