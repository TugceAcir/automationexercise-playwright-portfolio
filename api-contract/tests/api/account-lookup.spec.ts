import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixture';

// Read-only. getUserDetailByEmail is the lookup every lifecycle write proof relies on, so its two
// refusals are contract-tested on their own. No account is created, changed or deleted.
test.describe('Account lookup API', () => {
  test('@API011 @api @read @account @negative account lookup without an email is refused as a bad request', async ({ api }) => {
    const { body } = await api.lookupAccountRefusal();

    expect(body.responseCode).toBe(400);
    expect(body.message).toBe('Bad request, email parameter is missing in GET request.');
  });

  test('@API012 @api @read @account @negative account lookup for an email that cannot exist reports account not found', async ({ api }) => {
    // .invalid is reserved (RFC 2606), so this address can never belong to a real account.
    const { body } = await api.lookupAccountRefusal(`api-contract-absent-${randomUUID()}@example.invalid`);

    expect(body.responseCode).toBe(404);
    expect(body.message).toBe('Account not found with this email, try another email!');
  });
});
