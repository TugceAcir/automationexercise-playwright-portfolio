import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeServerErrors,
  formatServerErrorCounts,
  isDemoSiteUrl,
  mergeServerErrorCounts,
  parseServerErrorCounts,
  totalServerErrors
} from '../../shared/demo-site-server-errors';

test('server error counts round-trip through the annotation format in status order', () => {
  const formatted = formatServerErrorCounts({ '503': 28, '500': 1, '502': 0 });

  assert.equal(formatted, '500:1,503:28');
  assert.deepEqual(parseServerErrorCounts(formatted), { '500': 1, '503': 28 });
});

test('parseServerErrorCounts ignores anything that is not a 5xx count', () => {
  assert.deepEqual(parseServerErrorCounts('404:3, 503:2 ,garbage,520:x'), { '503': 2 });
  assert.deepEqual(parseServerErrorCounts(undefined), {});
});

test('counts merge across attempts and describe themselves for a reader', () => {
  const merged = mergeServerErrorCounts({ '503': 20 }, { '503': 8, '520': 1 });

  assert.equal(totalServerErrors(merged), 29);
  assert.equal(describeServerErrors(merged), '29 (503 x28, 520 x1)');
  assert.equal(describeServerErrors({}), 'none observed');
});

test('isDemoSiteUrl counts the demo site and its subdomains, never third parties', () => {
  const baseUrl = 'https://automationexercise.com/';

  assert.equal(isDemoSiteUrl('https://automationexercise.com/payment', baseUrl), true);
  assert.equal(isDemoSiteUrl('https://www.automationexercise.com/', baseUrl), true);
  assert.equal(isDemoSiteUrl('https://pagead2.googlesyndication.com/ad', baseUrl), false);
  assert.equal(isDemoSiteUrl('https://notautomationexercise.com/', baseUrl), false);
  assert.equal(isDemoSiteUrl('not a url', baseUrl), false);
});
