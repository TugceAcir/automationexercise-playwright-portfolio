import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_BASE_URL, resolveBaseUrl } from '../../shared/base-url';

test('resolveBaseUrl defaults to the public demo site', () => {
  assert.equal(resolveBaseUrl(undefined), DEFAULT_BASE_URL);
});

test('resolveBaseUrl accepts http and https URLs', () => {
  assert.equal(resolveBaseUrl('https://example.test/path'), 'https://example.test/path');
  assert.equal(resolveBaseUrl('http://localhost:3000'), 'http://localhost:3000/');
});

test('resolveBaseUrl rejects invalid URLs', () => {
  assert.throws(() => resolveBaseUrl('not a url'), /valid http\(s\) URL/);
});

test('resolveBaseUrl rejects non-http protocols', () => {
  assert.throws(() => resolveBaseUrl('file:///tmp/site.html'), /must use http or https/);
});
