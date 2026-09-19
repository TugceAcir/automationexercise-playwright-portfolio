import { test, expect } from '../../src/fixture';

// The API answers HTTP 200 even when it refuses a method; the refusal lives only in the body's
// responseCode. These cases prove the suite reads the body rather than trusting the status.
const unsupportedMethods = [
  { id: '@API008', method: 'POST', path: '/api/productsList', risk: '@catalog' },
  { id: '@API009', method: 'PUT', path: '/api/brandsList', risk: '@catalog' },
  { id: '@API010', method: 'DELETE', path: '/api/verifyLogin', risk: '@auth' }
] as const;

test.describe('Unsupported methods', () => {
  for (const { id, method, path, risk } of unsupportedMethods) {
    test(`${id} @api @read ${risk} @negative ${method} ${path} is refused as an unsupported method`, async ({ api }) => {
      const { body } = await api.sendUnsupportedMethod(method, path);

      expect(body.responseCode).toBe(405);
      expect(body.message).toBe('This request method is not supported.');
    });
  }
});
