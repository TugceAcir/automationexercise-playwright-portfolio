import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoTestsFound, parseListReport, renderApiCoverageBlock, replaceMarkedBlock, summarizeApiCoverage } from '../../scripts/coverage-counts';

const LIST_REPORT = {
  errors: [],
  suites: [
    { specs: [{ file: 'catalog.spec.ts', title: '@API001 @api @read list', tests: [{}] }] },
    {
      specs: [],
      suites: [
        {
          specs: [
            { file: 'unsupported-methods.spec.ts', title: '@API008 @api @read POST refused', tests: [{}] },
            { file: 'unsupported-methods.spec.ts', title: '@API009 @api @read PUT refused', tests: [{}] }
          ]
        }
      ]
    }
  ]
};

test('tests generated in a loop are each counted, grouped by area', () => {
  const summary = summarizeApiCoverage(parseListReport(LIST_REPORT, 'read'));

  assert.equal(summary.totalScenarios, 3);
  assert.deepEqual(summary.areas, [
    { file: 'catalog.spec.ts', name: 'Catalog', tests: 1 },
    { file: 'unsupported-methods.spec.ts', name: 'Unsupported Methods', tests: 2 }
  ]);
});

test('read and lifecycle tests are counted separately', () => {
  const summary = summarizeApiCoverage([
    { suite: 'read', file: 'catalog.spec.ts', title: '@API001 @api @read list' },
    { suite: 'lifecycle', file: 'account-lifecycle.spec.ts', title: '@API101 @api @write journey' }
  ]);

  assert.deepEqual([summary.totalScenarios, summary.readScenarios, summary.lifecycleScenarios], [2, 1, 1]);
});

test('a missing or duplicated @API ID fails the count instead of being counted', () => {
  assert.throws(() => summarizeApiCoverage([{ suite: 'read', file: 'a.spec.ts', title: '@api @read no id' }]), /exactly one @API### ID/);
  assert.throws(
    () => summarizeApiCoverage([
      { suite: 'read', file: 'a.spec.ts', title: '@API001 @read one' },
      { suite: 'lifecycle', file: 'b.spec.ts', title: '@API001 @write two' }
    ]),
    /Duplicate test ID @API001/
  );
});

test('every test needs exactly one ownership tag, matching the suite it runs in', () => {
  assert.throws(() => summarizeApiCoverage([{ suite: 'read', file: 'a.spec.ts', title: '@API001 @api untagged' }]), /exactly one of @read or @write; found 0/);
  assert.throws(() => summarizeApiCoverage([{ suite: 'read', file: 'a.spec.ts', title: '@API001 @read @write both' }]), /found 2/);
  // A write test in the read suite would run after every regression - the split exists to stop that.
  assert.throws(() => summarizeApiCoverage([{ suite: 'read', file: 'a.spec.ts', title: '@API101 @write creates' }]), /tagged @write but lives in the read suite/);
  assert.throws(() => summarizeApiCoverage([{ suite: 'lifecycle', file: 'a.spec.ts', title: '@API102 @read reads' }]), /tagged @read but lives in the lifecycle suite/);
  // A tag must be a whole word, so @readonly or @write-ish do not count.
  assert.throws(() => summarizeApiCoverage([{ suite: 'read', file: 'a.spec.ts', title: '@API001 @readonly list' }]), /found 0/);
});

test('a listing error fails loudly rather than producing a smaller count', () => {
  assert.throws(() => parseListReport({ errors: [{ message: 'SyntaxError in search.spec.ts' }], suites: [] }), /SyntaxError/);
});

test('a suite with no tests yet is recognised as zero, and only that case', () => {
  assert.equal(isNoTestsFound({ suites: [], errors: [{ message: 'Error: No tests found' }] }), true);
  assert.equal(isNoTestsFound({ suites: [], errors: [{ message: 'SyntaxError in account.spec.ts' }] }), false);
  assert.equal(isNoTestsFound({ suites: [], errors: [] }), false);
});

test('the public wording stays read-only until a lifecycle test exists', () => {
  const readOnly = renderApiCoverageBlock({ areas: [{ file: 'catalog.spec.ts', name: 'Catalog', tests: 2 }], totalScenarios: 2, readScenarios: 2, lifecycleScenarios: 0 });
  const withLifecycle = renderApiCoverageBlock({ areas: [], totalScenarios: 5, readScenarios: 2, lifecycleScenarios: 3 });

  assert.match(readOnly, /^Last generated API contract snapshot: 2 read-only scenarios in one non-browser project/);
  assert.doesNotMatch(readOnly, /lifecycle/);
  assert.match(withLifecycle, /5 scenarios in two non-browser suites - 2 read-only, and 3 account-lifecycle scenarios that write only to generated accounts/);
});

test('only the api-coverage block is replaced; the UI coverage block is left byte-for-byte', () => {
  const ui = '<!-- coverage:start -->\nUI 69 / 207\n<!-- coverage:end -->';
  const doc = `${ui}\n\n<!-- api-coverage:start -->\nold\n<!-- api-coverage:end -->\n`;
  const block = renderApiCoverageBlock({ areas: [{ file: 'catalog.spec.ts', name: 'Catalog', tests: 2 }], totalScenarios: 2, readScenarios: 2, lifecycleScenarios: 0 });
  const next = replaceMarkedBlock(doc, block);

  assert.ok(next.startsWith(ui));
  assert.match(next, /<!-- api-coverage:start -->\nLast generated API contract snapshot: 2 read-only scenarios/);
  assert.match(next, /\| Catalog \| 2 \|\n<!-- api-coverage:end -->/);
  assert.throws(() => replaceMarkedBlock(ui, block), /Missing api-coverage markers/);
});
