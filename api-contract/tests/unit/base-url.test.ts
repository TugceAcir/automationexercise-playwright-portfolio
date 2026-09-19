import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BASE_URL, resolveBaseUrl } from '../../src/base-url';

test('the default target is the public demo site', () => {
  assert.equal(resolveBaseUrl(DEFAULT_BASE_URL), 'https://automationexercise.com/');
});

test('a malformed or non-http base URL is rejected', () => {
  assert.throws(() => resolveBaseUrl('not a url'), /valid http\(s\) URL/);
  assert.throws(() => resolveBaseUrl('ftp://automationexercise.com'), /must use http or https/);
});
