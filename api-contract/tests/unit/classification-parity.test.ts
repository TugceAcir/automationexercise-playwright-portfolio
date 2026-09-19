import assert from 'node:assert/strict';
import test from 'node:test';
import * as api from '../../src/classification';
// Deliberate one-way, test-only read of the UI side (see the approved plan's Isolation Design).
// That file has no imports of its own, and no API runtime code ever imports it.
import * as ui from '../../../shared/demo-site-classification';

const SAMPLE_PAGES = [
  '<title>One moment, please</title>',
  'Just a moment...',
  'Checking your browser before accessing automationexercise.com',
  'Please verify you are human',
  '500 Internal Server Error',
  '503 Service Unavailable',
  'Error code 503',
  'Error code 520',
  'Queue full, please try again later',
  'Sorry, too many people are accessing this website at the moment',
  'Web server is returning an unknown error',
  '{"responseCode": 200, "products": []}',
  '<html><body>Automation Exercise home</body></html>',
  ''
];

test('the API copy of the bot-challenge rule agrees with the UI rule on every sample page', () => {
  for (const page of SAMPLE_PAGES) {
    assert.equal(api.isBotChallenge(page), ui.isBotChallenge(page), `disagreement on: ${JSON.stringify(page)}`);
  }
});

test('the API copy of the transient-page rule agrees with the UI rule on every sample page', () => {
  for (const page of SAMPLE_PAGES) {
    assert.equal(api.isTransientPage(page), ui.DEMO_SITE_ERROR_PATTERN.test(page), `disagreement on: ${JSON.stringify(page)}`);
  }
});

test('the two copies hold the same phrases and pattern, so a new rule on either side fails here', () => {
  assert.deepEqual(api.BOT_CHALLENGE_PHRASES, ui.BOT_CHALLENGE_PHRASES);
  assert.equal(api.DEMO_SITE_ERROR_PATTERN.source, ui.DEMO_SITE_ERROR_PATTERN.source);
  assert.equal(api.DEMO_SITE_ERROR_PATTERN.flags, ui.DEMO_SITE_ERROR_PATTERN.flags);
});
