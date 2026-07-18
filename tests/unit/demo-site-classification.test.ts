import assert from 'node:assert/strict';
import test from 'node:test';
import { isTransientDemoPageError } from '../../pages/app-navigation';
import { BOT_CHALLENGE_ERROR, classifyFailureCause, isBotChallenge } from '../../shared/demo-site-classification';

test('bot-challenge page text is recognised as environment risk', () => {
  assert.equal(isBotChallenge('<title>One moment, please</title>'), true);
  assert.equal(isBotChallenge('Checking your browser before accessing automationexercise.com'), true);
  assert.equal(classifyFailureCause('One moment, please'), 'environment');
});

test('bot-challenge error classifies as environment but is not retryable transient noise', () => {
  const error = new Error(BOT_CHALLENGE_ERROR);

  assert.equal(classifyFailureCause(error.message), 'environment');
  assert.equal(isTransientDemoPageError(error), false);
});

test('ordinary timeout text stays in the review bucket', () => {
  assert.equal(classifyFailureCause('locator.click: Timeout 10000ms exceeded'), 'other');
});
