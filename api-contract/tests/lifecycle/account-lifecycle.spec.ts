import { requireAnswer } from '../../src/client';
import { test, expect } from '../../src/lifecycle-fixture';

// The only suite in this package that writes. It runs on generated accounts of its own
// (src/test-user.ts) and never on an account anyone else owns, it runs only when explicitly
// selected (npm run test:lifecycle), and every account it registers is proven gone in teardown.
//
// Every expected code and message below was observed in the live discovery session of
// 2026-09-20, recorded in progress.md. Two of them are easy to get wrong from the published API
// list, so they are stated here once:
//
//   - A refused update or delete answers 404 "Account not found!" whether the password is wrong
//     or the account really is gone. The API does not distinguish the two, so a refusal test
//     carries its weight in the lookup that follows, not in the message.
//   - The three absence messages differ: the lookup says "Account not found with this email,
//     try another email!", update and delete say "Account not found!", and verifyLogin says
//     "User not found!". They are not interchangeable.

const WRONG_PASSWORD = 'NotThePassword!9999';

test.describe('Generated account lifecycle API', () => {
  test('@API101 @api @write @account a generated account can be created, found, logged into, updated and deleted', async ({ api, accounts }) => {
    const { account, result } = await accounts.create();

    const created = requireAnswer(result, `Creating account ${account.email}`);
    expect(created.body.responseCode).toBe(201);
    expect(created.body.message).toBe('User created!');

    const found = await api.lookupAccount(account.email);
    expect(found.body.responseCode).toBe(200);
    expect(found.body.user).toMatchObject({
      email: account.email,
      name: account.name,
      company: account.company,
      city: account.city,
      // The lookup renames these: the form sent firstname/lastname/birth_date.
      first_name: account.firstName,
      last_name: account.lastName,
      birth_day: account.birthDate
    });

    const login = await api.verifyLogin({ email: account.email, password: account.password });
    expect(login.body.responseCode).toBe(200);
    expect(login.body.message).toBe('User exists!');

    const changes = { company: 'API Contract Updated', city: 'UpdatedCity', state: 'UpdatedState' };
    const updated = requireAnswer(await api.updateAccount(account, { changes }), `Updating account ${account.email}`);
    expect(updated.body.responseCode).toBe(200);
    expect(updated.body.message).toBe('User updated!');

    const afterUpdate = await api.lookupAccount(account.email);
    expect(afterUpdate.body.user).toMatchObject({ company: changes.company, city: changes.city, state: changes.state });
    // The account keeps its identity across an update.
    expect(afterUpdate.body.user.id).toBe(found.body.user.id);
    expect(afterUpdate.body.user.email).toBe(account.email);

    const deleted = requireAnswer(
      await api.deleteAccount({ email: account.email, password: account.password }),
      `Deleting account ${account.email}`
    );
    expect(deleted.body.responseCode).toBe(200);
    expect(deleted.body.message).toBe('Account deleted!');

    const afterDelete = await api.lookupAccountRefusal(account.email);
    expect(afterDelete.body.responseCode).toBe(404);
    expect(afterDelete.body.message).toBe('Account not found with this email, try another email!');

    const loginAfterDelete = await api.verifyLogin({ email: account.email, password: account.password });
    expect(loginAfterDelete.body.responseCode).toBe(404);
    expect(loginAfterDelete.body.message).toBe('User not found!');
  });

  test('@API102 @api @write @account @negative registering an email that already exists is refused and leaves the account untouched', async ({ api, accounts }) => {
    const { account } = await accounts.create();
    const before = await api.lookupAccount(account.email);

    const duplicate = requireAnswer(await api.createAccount(account), `Creating account ${account.email}`);
    expect(duplicate.body.responseCode).toBe(400);
    expect(duplicate.body.message).toBe('Email already exists!');

    // The refusal matters only if the original survived it intact.
    const after = await api.lookupAccount(account.email);
    expect(after.body.user).toEqual(before.body.user);
  });

  test('@API103 @api @write @account @negative deleting with the wrong password is refused and the account is still there', async ({ api, accounts }) => {
    const { account } = await accounts.create();
    const before = await api.lookupAccount(account.email);

    const refused = requireAnswer(
      await api.deleteAccount({ email: account.email, password: WRONG_PASSWORD }),
      `Deleting account ${account.email}`
    );
    expect(refused.body.responseCode).toBe(404);
    expect(refused.body.message).toBe('Account not found!');

    // This is the real assertion: the wrong password changed nothing.
    const after = await api.lookupAccount(account.email);
    expect(after.body.responseCode).toBe(200);
    expect(after.body.user).toEqual(before.body.user);
  });

  test('@API104 @api @write @account @negative updating with the wrong password is refused and no field changes', async ({ api, accounts }) => {
    const { account } = await accounts.create();
    const before = await api.lookupAccount(account.email);

    const changes = { company: 'SHOULD NOT LAND', city: 'ShouldNotLandCity' };
    const refused = requireAnswer(
      await api.updateAccount(account, { changes, password: WRONG_PASSWORD }),
      `Updating account ${account.email}`
    );
    expect(refused.body.responseCode).toBe(404);
    expect(refused.body.message).toBe('Account not found!');

    const after = await api.lookupAccount(account.email);
    expect(after.body.user).toEqual(before.body.user);
    expect(after.body.user.company).not.toBe(changes.company);
    expect(after.body.user.city).not.toBe(changes.city);
  });
});
