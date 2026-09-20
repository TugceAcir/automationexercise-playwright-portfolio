import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ENVIRONMENT_MARKER } from '../../src/classification';
import { readCleanupEvidence } from '../../src/cleanup-evidence';
import { GeneratedAccounts } from '../../src/lifecycle-fixture';
import { LifecycleTracker } from '../../src/lifecycle-tracker';
import { createGeneratedAccount } from '../../src/test-user';
import type { ApiClient } from '../../src/client';
import type { WriteResult } from '../../src/client';

function evidenceFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'api-cleanup-')), 'cleanup.json');
}

function read(file: string): { runId: string; accounts: { email: string; state: string; detail?: string }[] } {
  return JSON.parse(readFileSync(file, 'utf8')) as { runId: string; accounts: { email: string; state: string; detail?: string }[] };
}

/** An ApiClient stand-in: presence is scripted per call, deletes are counted. */
function fakeApi(script: { presence: ('present' | 'absent' | Error)[]; onDelete?: () => void }): { api: ApiClient; deletes: () => number } {
  let index = 0;
  let deletes = 0;
  const api = {
    accountPresence: async () => {
      const next = script.presence[index++] ?? 'absent';

      if (next instanceof Error) throw next;

      return next;
    },
    deleteAccount: async (): Promise<WriteResult> => {
      deletes += 1;
      script.onDelete?.();

      return { kind: 'answered', httpStatus: 200, body: { responseCode: 200, message: 'Account deleted!' }, attempts: 1 };
    },
    createAccount: async (): Promise<WriteResult> => ({ kind: 'answered', httpStatus: 200, body: { responseCode: 201, message: 'User created!' }, attempts: 1 })
  } as unknown as ApiClient;

  return { api, deletes: () => deletes };
}

test('an account is on file before its create is sent', () => {
  const file = evidenceFile();
  const tracker = new LifecycleTracker(file, 'run-1');
  const accounts = new GeneratedAccounts(fakeApi({ presence: [] }).api, tracker);

  const account = accounts.register();

  // Written synchronously by register(), i.e. before any request goes out.
  assert.deepEqual(read(file).accounts, [{ email: account.email, state: 'creation-attempted' }]);
});

test('an account the test already deleted is proven clean without a second delete', async () => {
  const file = evidenceFile();
  const accounts = new GeneratedAccounts(fakeApi({ presence: ['absent'] }).api, new LifecycleTracker(file, 'run-1'));
  const account = accounts.register();

  await accounts.cleanUp();

  assert.deepEqual(read(file).accounts, [{ email: account.email, state: 'deleted-proven', detail: 'absent at teardown' }]);
});

test('an account the test left behind is deleted and proven gone', async () => {
  const file = evidenceFile();
  const fake = fakeApi({ presence: ['present', 'absent'] });
  const accounts = new GeneratedAccounts(fake.api, new LifecycleTracker(file, 'run-1'));
  const account = accounts.register();

  await accounts.cleanUp();

  assert.equal(fake.deletes(), 1);
  assert.deepEqual(read(file).accounts, [{ email: account.email, state: 'deleted-proven', detail: 'deleted at teardown' }]);
});

test('an account still present after its delete is a leftover, and fails the run', async () => {
  const file = evidenceFile();
  const accounts = new GeneratedAccounts(fakeApi({ presence: ['present', 'present'] }).api, new LifecycleTracker(file, 'run-1'));
  const account = accounts.register();

  await assert.rejects(accounts.cleanUp(), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER) && error.message.includes(account.email));
  assert.equal(read(file).accounts[0].state, 'leftover');
});

test('a cleanup whose check cannot be made is a leftover, never a silent pass', async () => {
  const file = evidenceFile();
  const accounts = new GeneratedAccounts(fakeApi({ presence: [new Error('site down')] }).api, new LifecycleTracker(file, 'run-1'));
  const account = accounts.register();

  await assert.rejects(accounts.cleanUp(), (error: Error) => error.message.includes(account.email));
  assert.deepEqual(read(file).accounts, [{ email: account.email, state: 'leftover', detail: 'site down' }]);
});

test('the tracker reloads its own run and ignores a record from another run', () => {
  const file = evidenceFile();
  const first = createGeneratedAccount();
  writeFileSync(file, JSON.stringify({ runId: 'run-1', accounts: [{ email: first.email, state: 'present' }] }));

  const sameRun = new LifecycleTracker(file, 'run-1');
  const second = createGeneratedAccount();
  sameRun.record(second.email, 'creation-attempted');
  assert.deepEqual(read(file).accounts.map((account) => account.email).sort(), [first.email, second.email].sort());

  // A tracker for a different run starts empty rather than adopting someone else's accounts.
  writeFileSync(file, JSON.stringify({ runId: 'run-1', accounts: [{ email: first.email, state: 'present' }] }));
  const otherRun = new LifecycleTracker(file, 'run-2');
  otherRun.record(second.email, 'creation-attempted');
  assert.deepEqual(read(file).accounts, [{ email: second.email, state: 'creation-attempted' }]);
  assert.equal(readCleanupEvidence(file, 'run-1').status, 'unavailable');
});
