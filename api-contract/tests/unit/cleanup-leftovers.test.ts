import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanUpAccounts, collectCandidates, parseArgs, renderOutcomes } from '../../scripts/cleanup-leftovers';
import { createGeneratedAccount, derivePassword, generatedIdFromEmail } from '../../src/test-user';
import type { ApiClient, WriteResult } from '../../src/client';

const GENERATED = createGeneratedAccount().email;

function fakeApi(script: { presence: ('present' | 'absent')[] }): { api: ApiClient; deleted: string[] } {
  let index = 0;
  const deleted: string[] = [];
  const api = {
    accountPresence: async () => script.presence[index++] ?? 'absent',
    deleteAccount: async (credentials: { email: string; password: string }): Promise<WriteResult> => {
      deleted.push(`${credentials.email}|${credentials.password}`);

      return { kind: 'answered', httpStatus: 200, body: { responseCode: 200, message: 'Account deleted!' }, attempts: 1 };
    }
  } as unknown as ApiClient;

  return { api, deleted };
}

test('deleting requires --confirm; by default it only reports', () => {
  assert.deepEqual(parseArgs(['--email', 'a@example.com']), { emails: ['a@example.com'], confirm: false });
  assert.equal(parseArgs(['--email', 'a@example.com', '--confirm']).confirm, true);
  assert.equal(parseArgs(['--file', 'cleanup.json']).file, 'cleanup.json');
});

test('it refuses to run with no target, and rejects an unknown flag', () => {
  assert.throws(() => parseArgs([]), /Nothing to do/);
  assert.throws(() => parseArgs(['--all']), /Unknown argument/);
});

test('candidates are the record rows that are not already proven deleted, plus any given by hand', () => {
  const record = JSON.stringify({
    runId: 'run-1',
    accounts: [
      { email: 'left@example.com', state: 'leftover' },
      { email: 'attempted@example.com', state: 'creation-attempted' },
      { email: 'done@example.com', state: 'deleted-proven' }
    ]
  });

  const candidates = collectCandidates({ emails: ['extra@example.com'], file: 'cleanup.json', confirm: false }, () => record);

  assert.deepEqual(candidates.sort(), ['attempted@example.com', 'extra@example.com', 'left@example.com'].sort());
});

test('an address this package did not generate is refused, never deleted', async () => {
  const fake = fakeApi({ presence: ['present'] });

  const outcomes = await cleanUpAccounts(['someone.real@gmail.com'], true, fake.api);

  assert.deepEqual(outcomes, [{ email: 'someone.real@gmail.com', outcome: 'refused', detail: 'not an address this package generates' }]);
  assert.deepEqual(fake.deleted, []);
  assert.equal(generatedIdFromEmail('someone.real@gmail.com'), undefined);
});

test('a dry run sends no delete and still reports what it would remove', async () => {
  const fake = fakeApi({ presence: ['present'] });

  const outcomes = await cleanUpAccounts([GENERATED], false, fake.api);

  assert.equal(outcomes[0].outcome, 'would-delete');
  assert.deepEqual(fake.deleted, []);
  assert.match(renderOutcomes(outcomes, false), /nothing was deleted/);
});

test('with --confirm a present account is deleted with its derived password and proven gone', async () => {
  const fake = fakeApi({ presence: ['present', 'absent'] });

  const outcomes = await cleanUpAccounts([GENERATED], true, fake.api);

  assert.equal(outcomes[0].outcome, 'deleted');
  assert.deepEqual(fake.deleted, [`${GENERATED}|${derivePassword(generatedIdFromEmail(GENERATED) as string)}`]);
});

test('an account still present after its delete is reported unresolved', async () => {
  const fake = fakeApi({ presence: ['present', 'present'] });

  const outcomes = await cleanUpAccounts([GENERATED], true, fake.api);

  assert.deepEqual(outcomes, [{ email: GENERATED, outcome: 'unresolved', detail: 'still present after a delete' }]);
  assert.match(renderOutcomes(outcomes, true), /1 unresolved/);
});

test('an account that is already gone is reported absent, with no delete sent', async () => {
  const fake = fakeApi({ presence: ['absent'] });

  const outcomes = await cleanUpAccounts([GENERATED], true, fake.api);

  assert.deepEqual(outcomes, [{ email: GENERATED, outcome: 'absent' }]);
  assert.deepEqual(fake.deleted, []);
});
