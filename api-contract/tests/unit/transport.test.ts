import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTRACT_MARKER, ENVIRONMENT_MARKER } from '../../src/classification';
import { ApiTransport } from '../../src/transport';
import type { ApiRequest, RawResponse } from '../../src/transport';

// Collapse the retry pause so these tests stay instant.
process.env.API_RETRY_DELAY_MS = '0';

const READ: ApiRequest = { method: 'GET', path: '/api/productsList', retrySafe: true };
const NOT_RETRY_SAFE: ApiRequest = { method: 'GET', path: '/api/productsList' };
const LOAD_PAGE = '<html><body>Our server is busy: too many people are accessing this website</body></html>';

function scripted(responses: RawResponse[]): { transport: ApiTransport; calls: () => number } {
  let calls = 0;
  const transport = new ApiTransport(async () => responses[Math.min(calls++, responses.length - 1)]);

  return { transport, calls: () => calls };
}

test('JSON is parsed from the body regardless of the text/html label the live API sends', async () => {
  const { transport } = scripted([{ status: 200, text: '{"responseCode": 405, "message": "This request method is not supported."}' }]);

  const response = await transport.send(READ);

  assert.deepEqual(response, { httpStatus: 200, body: { responseCode: 405, message: 'This request method is not supported.' } });
});

test('a bot-challenge page is an environment failure and is never retried', async () => {
  const { transport, calls } = scripted([{ status: 200, text: '<title>Just a moment...</title>' }]);

  await assert.rejects(transport.send(READ), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER));
  assert.equal(calls(), 1);
});

test('a retry-safe read recovers from one transient load page', async () => {
  const { transport, calls } = scripted([
    { status: 200, text: LOAD_PAGE },
    { status: 200, text: '{"responseCode": 200, "brands": []}' }
  ]);

  const response = await transport.send(READ);

  assert.deepEqual(response.body, { responseCode: 200, brands: [] });
  assert.equal(calls(), 2);
});

test('a transient failure that repeats on the single retry is an environment failure', async () => {
  const { transport, calls } = scripted([{ status: 503, text: '503 Service Unavailable' }]);

  await assert.rejects(transport.send(READ), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER));
  assert.equal(calls(), 2);
});

test('a request not marked retry-safe is never repeated, even after a confirmed transient failure', async () => {
  const { transport, calls } = scripted([{ status: 502, text: '<html>Bad Gateway</html>' }]);

  await assert.rejects(transport.send(NOT_RETRY_SAFE), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER));
  assert.equal(calls(), 1);
});

test('an unrecognised HTML page on a 200 is a contract failure, not an outage', async () => {
  const { transport, calls } = scripted([{ status: 200, text: '<html><body>Welcome to our new shop</body></html>' }]);

  await assert.rejects(transport.send(READ), (error: Error) => error.message.startsWith(CONTRACT_MARKER) && error.message.includes('unrecognised HTML'));
  assert.equal(calls(), 1);
});

test('malformed JSON is a contract failure', async () => {
  const { transport } = scripted([{ status: 200, text: '{"responseCode": 200, "products": [' }]);

  await assert.rejects(transport.send(READ), (error: Error) => error.message.startsWith(CONTRACT_MARKER) && error.message.includes('malformed JSON'));
});

test('a JSON 5xx is the application answering, so it is returned for the contract assertions', async () => {
  const { transport, calls } = scripted([{ status: 500, text: '{"responseCode": 500, "message": "boom"}' }]);

  const response = await transport.send(READ);

  assert.equal(response.httpStatus, 500);
  assert.equal(calls(), 1);
});
