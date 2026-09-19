import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyFailure, readSummary, renderMarkdown, summarize } from '../../scripts/api-summary';

const REPORT = {
  suites: [
    {
      specs: [{ title: '@API001 passes', tests: [{ status: 'expected', results: [{ status: 'passed' }] }] }],
      suites: [
        {
          specs: [
            { title: '@API002 site outage', tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message: '[api-environment] GET /api/brandsList was answered with a bot-challenge page (HTTP 200).' } }] }] },
            { title: '@API003 wrong code', tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message: '\u001b[31mError: expect(received).toBe(expected)\u001b[39m\n\nExpected: 400' } }] }] },
            { title: '@API004 network', tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message: 'apiRequestContext.fetch: read ECONNRESET' } }] }] },
            { title: '@API005 skipped', tests: [{ status: 'skipped', results: [] }] },
            { title: '@API006 flaky', tests: [{ status: 'flaky', results: [] }] }
          ]
        }
      ]
    }
  ]
};

test('outcomes are counted from nested suites', () => {
  const summary = summarize(REPORT);

  assert.equal(summary.resultsFound, true);
  if (!summary.resultsFound) return;
  assert.deepEqual([summary.passed, summary.flaky, summary.failed, summary.skipped], [1, 1, 3, 1]);
});

test('failures split into environment, contract and needs review, and only a tagged failure is environment', () => {
  assert.equal(classifyFailure('[api-environment] bot page'), 'environment');
  assert.equal(classifyFailure('[api-contract] schema'), 'contract');
  assert.equal(classifyFailure('Error: expect(received).toBe(expected)'), 'contract');
  assert.equal(classifyFailure('apiRequestContext.fetch: read ECONNRESET'), 'needs review');
});

test('the markdown carries the counts and each failure with colour codes stripped', () => {
  const markdown = renderMarkdown(summarize(REPORT));

  assert.match(markdown, /\| 1 \| 1 \| 3 \| 1 \|/);
  assert.match(markdown, /environment 1, contract 1, needs review 1/);
  assert.match(markdown, /@API003 wrong code \| contract \| Error: expect\(received\)\.toBe\(expected\) \|/);
  assert.equal(markdown.includes('\u001b'), false);
});

test('a missing results file is reported explicitly and never as zero failures', () => {
  const summary = readSummary(join(tmpdir(), `no-such-api-results-${process.pid}.json`));
  const markdown = renderMarkdown(summary);

  assert.deepEqual(summary, { resultsFound: false });
  assert.match(markdown, /No results file was found/);
  assert.match(markdown, /It is not a pass/);
  assert.doesNotMatch(markdown, /\| 0 \|/);
});
