import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { request } from '@playwright/test';
import { CONTRACT_MARKER, ENVIRONMENT_MARKER } from '../../src/classification';
import { ApiClient } from '../../src/client';
import { ApiTransport, isUncertainWrite } from '../../src/transport';
import type { ApiRequest, RawResponse } from '../../src/transport';

const DELETE: ApiRequest = { method: 'DELETE', path: '/api/deleteAccount', form: { email: 'a@example.com', password: 'x' }, retrySafe: true };

function transportAnswering(responses: (RawResponse | Error)[]): { transport: ApiTransport; calls: () => number } {
  let calls = 0;
  const transport = new ApiTransport(async () => {
    const next = responses[Math.min(calls++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });

  return { transport, calls: () => calls };
}

test('a write is never repeated by the transport, even when marked retry-safe', async () => {
  const { transport, calls } = transportAnswering([{ status: 503, text: '503 Service Unavailable' }]);

  const result = await transport.sendWrite(DELETE);

  assert.equal(isUncertainWrite(result), true);
  assert.equal(calls(), 1);
});

test('every lost answer becomes an uncertain write that keeps its reason', async () => {
  const cases: [RawResponse | Error, RegExp][] = [
    [{ status: 200, text: 'Sorry, too many people are accessing this website' }, /known transient load\/error page/],
    [{ status: 502, text: '<html>Bad Gateway</html>' }, /HTTP 502 with a non-JSON body/],
    [{ status: 200, text: '<title>Just a moment...</title>' }, /bot-challenge page/],
    [new Error('read ECONNRESET'), /failed in transit: read ECONNRESET/]
  ];

  for (const [answer, reason] of cases) {
    const result = await transportAnswering([answer]).transport.sendWrite(DELETE);

    assert.ok(isUncertainWrite(result), `expected uncertain for ${String(reason)}`);
    assert.match(result.reason, reason);
  }
});

test('a readable but wrong answer to a write is a contract failure, not an uncertain write', async () => {
  const { transport } = transportAnswering([{ status: 200, text: '<html><body>Welcome to our new shop</body></html>' }]);

  await assert.rejects(transport.sendWrite(DELETE), (error: Error) => error.message.startsWith(CONTRACT_MARKER));
});

test('a normal JSON answer to a write is returned as-is', async () => {
  const { transport } = transportAnswering([{ status: 200, text: '{"responseCode": 200, "message": "Account deleted!"}' }]);

  assert.deepEqual(await transport.sendWrite(DELETE), { httpStatus: 200, body: { responseCode: 200, message: 'Account deleted!' } });
});

// The real Playwright request context against a local server: proves query encoding and the
// lookup's presence mapping without contacting the demo site.
test('lookup queries are URL-encoded by the real transport, and presence maps 200/404 and rejects anything else', async () => {
  const seen: string[] = [];
  const server = createServer((incoming, outgoing) => {
    const url = new URL(incoming.url ?? '/', 'http://localhost');
    const email = url.searchParams.get('email') ?? '';
    seen.push(incoming.url ?? '');
    const code = email.startsWith('present') ? 200 : email.startsWith('odd') ? 500 : 404;
    outgoing.setHeader('content-type', 'text/html; charset=utf-8');
    outgoing.end(JSON.stringify(code === 200 ? { responseCode: 200, user: {} } : { responseCode: code, message: 'x' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = await request.newContext({ baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });

  try {
    const client = new ApiClient(new ApiTransport(context));

    assert.equal(await client.accountPresence('present+tag@example.com'), 'present');
    assert.equal(await client.accountPresence('api-contract.x@example.com'), 'absent');
    await assert.rejects(client.accountPresence('odd@example.com'), (error: Error) => error.message.startsWith(CONTRACT_MARKER));

    assert.equal(seen[0], '/api/getUserDetailByEmail?email=present%2Btag%40example.com');
  } finally {
    await context.dispose();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('an unprovable lookup never reads as absent', async () => {
  // A bot page on the lookup must surface as an environment failure, which the write proof turns
  // into "unknown" - it must not be mistaken for a 404.
  const client = new ApiClient(transportAnswering([{ status: 200, text: '<title>Just a moment...</title>' }]).transport);

  await assert.rejects(client.accountPresence('api-contract.x@example.com'), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER));
});
