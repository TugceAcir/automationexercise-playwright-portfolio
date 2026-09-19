import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListReport, renderApiCoverageBlock, replaceMarkedBlock, summarizeApiCoverage } from '../../scripts/coverage-counts';

const LIST_REPORT = {
  errors: [],
  suites: [
    { specs: [{ file: 'catalog.spec.ts', title: '@API001 @api list', tests: [{}] }] },
    {
      specs: [],
      suites: [
        {
          specs: [
            { file: 'unsupported-methods.spec.ts', title: '@API008 @api POST refused', tests: [{}] },
            { file: 'unsupported-methods.spec.ts', title: '@API009 @api PUT refused', tests: [{}] }
          ]
        }
      ]
    }
  ]
};

test('tests generated in a loop are each counted, grouped by area', () => {
  const summary = summarizeApiCoverage(parseListReport(LIST_REPORT));

  assert.equal(summary.totalScenarios, 3);
  assert.deepEqual(summary.areas, [
    { file: 'catalog.spec.ts', name: 'Catalog', tests: 1 },
    { file: 'unsupported-methods.spec.ts', name: 'Unsupported Methods', tests: 2 }
  ]);
});

test('a missing or duplicated @API ID fails the count instead of being counted', () => {
  assert.throws(() => summarizeApiCoverage([{ file: 'a.spec.ts', title: '@api no id' }]), /exactly one @API### ID/);
  assert.throws(
    () => summarizeApiCoverage([
      { file: 'a.spec.ts', title: '@API001 one' },
      { file: 'b.spec.ts', title: '@API001 two' }
    ]),
    /Duplicate test ID @API001/
  );
});

test('a listing error fails loudly rather than producing a smaller count', () => {
  assert.throws(() => parseListReport({ errors: [{ message: 'SyntaxError in search.spec.ts' }], suites: [] }), /SyntaxError/);
});

test('only the api-coverage block is replaced; the UI coverage block is left byte-for-byte', () => {
  const ui = '<!-- coverage:start -->\nUI 69 / 207\n<!-- coverage:end -->';
  const doc = `${ui}\n\n<!-- api-coverage:start -->\nold\n<!-- api-coverage:end -->\n`;
  const block = renderApiCoverageBlock({ areas: [{ file: 'catalog.spec.ts', name: 'Catalog', tests: 2 }], totalScenarios: 2 });
  const next = replaceMarkedBlock(doc, block);

  assert.ok(next.startsWith(ui));
  assert.match(next, /<!-- api-coverage:start -->\nLast generated API contract snapshot: 2 read-only scenarios/);
  assert.match(next, /\| Catalog \| 2 \|\n<!-- api-coverage:end -->/);
  assert.throws(() => replaceMarkedBlock(ui, block), /Missing api-coverage markers/);
});
