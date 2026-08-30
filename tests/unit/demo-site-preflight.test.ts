import assert from 'node:assert/strict';
import test from 'node:test';
import { BOT_CHALLENGE_ERROR, TRANSIENT_DEMO_SITE_ERROR } from '../../shared/demo-site-classification';
import { runDemoSitePreflight } from '../../scripts/demo-site-preflight';

const BASE_URL = 'https://automationexercise.com';
const CHALLENGE_BODY = '<html><body>Just a moment...</body></html>';
const GOOD_BODY = '<html><body>Automation Exercise home</body></html>';

type Call = { url: string; headers: Record<string, string> };

// Collapse the diagnostic wait so the challenge tests do not sit for five seconds.
process.env.PREFLIGHT_PROBE_DELAY_MS = '0';

function stubFetch(bodies: string[], status = 200): { calls: Call[]; restore: () => void } {
  const calls: Call[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string, init: { headers?: Record<string, string> } = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {} });
    const body = bodies[Math.min(calls.length - 1, bodies.length - 1)];

    return { status, text: async () => body };
  }) as unknown as typeof globalThis.fetch;

  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function captureStderr(run: () => Promise<void>): Promise<string> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };

  try {
    await run();
  } finally {
    console.error = original;
  }

  return lines.join('\n');
}

test('preflight identifies itself as a browser rather than as bare Node', async () => {
  const { calls, restore } = stubFetch([GOOD_BODY]);

  try {
    await runDemoSitePreflight(BASE_URL);
  } finally {
    restore();
  }

  assert.equal(calls.length, 1);
  // The suite this gates drives real browsers, so the check must not look less like one.
  assert.match(calls[0].headers['user-agent'], /Mozilla\/5\.0/);
  assert.ok(calls[0].headers.accept.includes('text/html'));
  assert.ok(calls[0].headers['accept-language']);
});

test('a bot challenge still fails the preflight', async () => {
  const { restore } = stubFetch([CHALLENGE_BODY]);

  try {
    await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(BOT_CHALLENGE_ERROR));
  } finally {
    restore();
  }
});

test('a challenge triggers one same-runner diagnostic probe and reports that it cleared', async () => {
  const { calls, restore } = stubFetch([CHALLENGE_BODY, GOOD_BODY]);
  let logged: string;

  try {
    logged = await captureStderr(async () => {
      await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(BOT_CHALLENGE_ERROR));
    });
  } finally {
    restore();
  }

  // Exactly one extra request: evidence gathering, not a retry loop.
  assert.equal(calls.length, 2);
  assert.match(logged, /challenge cleared/);
  assert.match(logged, /does not affect the preflight result/);
});

test('the diagnostic probe reports a persisting challenge without changing the outcome', async () => {
  const { calls, restore } = stubFetch([CHALLENGE_BODY, CHALLENGE_BODY]);
  let logged: string;

  try {
    logged = await captureStderr(async () => {
      await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(BOT_CHALLENGE_ERROR));
    });
  } finally {
    restore();
  }

  assert.equal(calls.length, 2);
  assert.match(logged, /challenge still present/);
});

test('a failing diagnostic probe does not mask the original challenge', async () => {
  const original = globalThis.fetch;
  let attempt = 0;
  globalThis.fetch = (async () => {
    attempt += 1;
    if (attempt === 1) return { status: 200, text: async () => CHALLENGE_BODY };
    throw new Error('socket hang up');
  }) as unknown as typeof globalThis.fetch;

  try {
    const logged = await captureStderr(async () => {
      await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(BOT_CHALLENGE_ERROR));
    });

    assert.match(logged, /Diagnostic re-probe failed/);
  } finally {
    globalThis.fetch = original;
  }
});

test('a transient server error page still fails the preflight and is not re-probed', async () => {
  const { calls, restore } = stubFetch(['<html>503 Service Unavailable</html>']);

  try {
    await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(TRANSIENT_DEMO_SITE_ERROR));
  } finally {
    restore();
  }

  // The diagnostic exists to answer the bot-challenge question only.
  assert.equal(calls.length, 1);
});

test('an empty body still fails the preflight', async () => {
  const { restore } = stubFetch(['   ']);

  try {
    await assert.rejects(runDemoSitePreflight(BASE_URL), new RegExp(TRANSIENT_DEMO_SITE_ERROR));
  } finally {
    restore();
  }
});
