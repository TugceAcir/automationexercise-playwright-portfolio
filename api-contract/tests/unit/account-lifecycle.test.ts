import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTRACT_MARKER, ENVIRONMENT_MARKER } from '../../src/classification';
import { ApiClient, requireAnswer } from '../../src/client';
import { userDetailSchema } from '../../src/schemas';
import { createGeneratedAccount, unprovableFields } from '../../src/test-user';
import { ApiTransport } from '../../src/transport';
import type { ApiRequest } from '../../src/transport';

// The account record exactly as the live API answered it on 2026-09-20.
const USER = {
  id: 2857751,
  name: 'API Contract ad5f1942',
  email: 'api-contract.ad5f1942-bb76-4077-80a0-bf84d8f50731@example.com',
  title: 'Mr',
  birth_day: '10',
  birth_month: '5',
  birth_year: '1990',
  first_name: 'Api',
  last_name: 'Contract',
  company: 'API Contract Suite',
  address1: '100 Automation Avenue',
  address2: 'Suite 42',
  country: 'United States',
  state: 'New York',
  city: 'New York',
  zipcode: '10001'
};

const TRANSIENT_PAGE = '<html><body><h1>503 Service Unavailable</h1></body></html>';

type Reply = { status?: number; text: string };

function clientWith(reply: (request: ApiRequest, callIndex: number) => Reply): { client: ApiClient; sent: ApiRequest[] } {
  const sent: ApiRequest[] = [];
  const client = new ApiClient(
    new ApiTransport(async (request) => {
      const answer = reply(request, sent.length);
      sent.push(request);

      return { status: answer.status ?? 200, text: answer.text };
    })
  );

  return { client, sent };
}

const json = (body: unknown): Reply => ({ text: JSON.stringify(body) });

test('the discovered account record parses, and a missing field is a contract failure', () => {
  assert.equal(userDetailSchema.parse({ responseCode: 200, user: USER }).user.id, 2857751);

  const withoutCity: Partial<typeof USER> = { ...USER };
  delete withoutCity.city;

  const { client } = clientWith(() => json({ responseCode: 200, user: withoutCity }));

  return assert.rejects(
    client.lookupAccount(USER.email),
    (error: Error) => error.message.startsWith(CONTRACT_MARKER) && error.message.includes('user.city')
  );
});

test('createAccount posts the whole form and returns the answered body', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith(() => json({ responseCode: 201, message: 'User created!' }));

  const result = await client.createAccount(account);

  assert.equal(result.kind, 'answered');
  assert.deepEqual(sent[0].form?.email, account.email);
  assert.equal(sent[0].method, 'POST');
  assert.equal(sent[0].path, '/api/createAccount');
  // The password is sent, but the form never carries a field the lookup would echo back.
  assert.equal(sent[0].form?.password, account.password);
  if (result.kind === 'answered') assert.equal(result.body.message, 'User created!');
});

test('a create whose answer is lost is proven by a lookup and never sent twice', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith((request) =>
    request.path === '/api/createAccount' ? { status: 503, text: TRANSIENT_PAGE } : json({ responseCode: 200, user: { ...USER, email: account.email } })
  );

  const result = await client.createAccount(account);

  assert.equal(result.kind, 'proven-committed');
  assert.equal(sent.filter((request) => request.path === '/api/createAccount').length, 1);
});

test('a create whose answer is lost and which did not land is never retried', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith((request) =>
    request.path === '/api/createAccount' ? { status: 503, text: TRANSIENT_PAGE } : json({ responseCode: 404, message: 'Account not found with this email, try another email!' })
  );

  await assert.rejects(client.createAccount(account), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER) && /never repeated/.test(error.message));
  assert.equal(sent.filter((request) => request.path === '/api/createAccount').length, 1);
});

test('an update with nothing changed is refused, because it could not be proven', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith(() => json({ responseCode: 200, message: 'User updated!' }));

  await assert.rejects(client.updateAccount(account, { changes: {} }), /at least one changed field/);
  assert.equal(sent.length, 0);
});

test('an update the lookup cannot report back is refused before anything is sent', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith(() => json({ responseCode: 200, message: 'User updated!' }));

  // The lookup answers with no mobile number at all (verified 2026-09-20).
  await assert.rejects(client.updateAccount(account, { changes: { mobile_number: '5550000000' } }), /mobile_number/);
  assert.equal(sent.length, 0);
  assert.deepEqual(unprovableFields({ mobile_number: '1', city: 'x', password: 'y' }), ['mobile_number']);
});

test('an update sends the overriding password when one is given, and the account fields otherwise', async () => {
  const account = createGeneratedAccount();
  const { client, sent } = clientWith(() => json({ responseCode: 404, message: 'Account not found!' }));

  await client.updateAccount(account, { changes: { city: 'UpdatedCity' }, password: 'NotThePassword!9999' });

  assert.equal(sent[0].method, 'PUT');
  assert.equal(sent[0].form?.password, 'NotThePassword!9999');
  assert.equal(sent[0].form?.city, 'UpdatedCity');
  assert.equal(sent[0].form?.email, account.email);
});

test('accountMatches reads the lookup name for a form field, not the form name', async () => {
  const { client } = clientWith(() => json({ responseCode: 200, user: USER }));

  // firstname -> first_name, birth_date -> birth_day.
  assert.equal(await client.accountMatches(USER.email, { firstname: 'Api', birth_date: '10' }), true);
  assert.equal(await client.accountMatches(USER.email, { firstname: 'Someone else' }), false);
});

test('a delete is proven by absence, and a refused delete leaves the proof negative', async () => {
  const { client } = clientWith((request) =>
    request.method === 'DELETE' ? json({ responseCode: 200, message: 'Account deleted!' }) : json({ responseCode: 404, message: 'Account not found with this email, try another email!' })
  );

  const result = await client.deleteAccount({ email: USER.email, password: 'whatever' });

  assert.equal(result.kind, 'answered');
  if (result.kind === 'answered') assert.equal(result.body.message, 'Account deleted!');
});

test('a write that only proved itself has no body to assert, and is an environment failure', () => {
  assert.throws(
    () => requireAnswer({ kind: 'proven-committed', reason: 'transient page', attempts: 1 }, 'Deleting account x@example.com'),
    (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER) && /answer was lost/.test(error.message)
  );

  const answered = requireAnswer({ kind: 'answered', httpStatus: 200, body: { responseCode: 200, message: 'Account deleted!' }, attempts: 1 }, 'x');
  assert.equal(answered.body.responseCode, 200);
});
