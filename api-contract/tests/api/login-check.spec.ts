import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixture';

// Read-only: verifyLogin only answers whether credentials match. No account is created,
// changed or deleted, and no real account's details are ever sent.
test.describe('Login check API', () => {
  test('@API006 @api @read @auth @negative login check without an email is refused as a bad request', async ({ api }) => {
    const { body } = await api.verifyLogin({ password: 'irrelevant-password' });

    expect(body.responseCode).toBe(400);
    expect(body.message).toBe('Bad request, email or password parameter is missing in POST request.');
  });

  test('@API007 @api @read @auth @negative login check for an email that was never registered reports user not found', async ({ api }) => {
    // .invalid is reserved (RFC 2606), so this address can never belong to a real account.
    const { body } = await api.verifyLogin({ email: `api-contract-${randomUUID()}@example.invalid`, password: 'irrelevant-password' });

    expect(body.responseCode).toBe(404);
    expect(body.message).toBe('User not found!');
  });
});
