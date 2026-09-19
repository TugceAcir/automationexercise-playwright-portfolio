import assert from 'node:assert/strict';
import test from 'node:test';
import { ENVIRONMENT_MARKER, UNCERTAIN_ACTION_OUTCOME_ERROR } from '../../src/classification';
import type { ApiResponse, UncertainWrite } from '../../src/transport';
import { performAndProveWrite } from '../../src/write-proof';
import type { ProvableWrite, ProvenState } from '../../src/write-proof';

const ANSWER: ApiResponse = { httpStatus: 200, body: { responseCode: 200, message: 'Account deleted!' } };
const LOST: UncertainWrite = { uncertain: true, reason: 'DELETE /api/deleteAccount hit a known transient load/error page (HTTP 503)' };

type Script = { sends: (ApiResponse | UncertainWrite)[]; proofs: (ProvenState | Error)[]; replay: boolean };

function scripted({ sends, proofs, replay }: Script): { write: ProvableWrite; sent: () => number; proved: () => number } {
  let sent = 0;
  let proved = 0;
  const write: ProvableWrite = {
    label: 'Deleting account api-contract.x@example.com',
    send: async () => sends[sent++],
    prove: async () => {
      const next = proofs[proved++];
      if (next instanceof Error) throw next;
      return next;
    },
    replayWhenNotCommitted: replay
  };

  return { write, sent: () => sent, proved: () => proved };
}

test('a normal answer is returned for ordinary assertion, with no proof and no repeat', async () => {
  const run = scripted({ sends: [ANSWER], proofs: [], replay: true });

  assert.deepEqual(await performAndProveWrite(run.write), { kind: 'answered', response: ANSWER, attempts: 1 });
  assert.deepEqual([run.sent(), run.proved()], [1, 0]);
});

test('a lost answer proven committed is reported as proven, never repeated', async () => {
  const run = scripted({ sends: [LOST], proofs: ['committed'], replay: true });

  const outcome = await performAndProveWrite(run.write);

  assert.equal(outcome.kind, 'proven-committed');
  assert.deepEqual([run.sent(), run.proved()], [1, 1]);
});

test('create is never replayed: proven not-committed is an environment failure after one send', async () => {
  const run = scripted({ sends: [LOST, ANSWER], proofs: ['not-committed'], replay: false });

  await assert.rejects(performAndProveWrite(run.write), (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER) && /never repeated/.test(error.message));
  assert.equal(run.sent(), 1);
});

test('update/delete are replayed once, only after a read proves the first attempt did not land', async () => {
  const run = scripted({ sends: [LOST, ANSWER], proofs: ['not-committed'], replay: true });

  assert.deepEqual(await performAndProveWrite(run.write), { kind: 'answered', response: ANSWER, attempts: 2 });
  assert.deepEqual([run.sent(), run.proved()], [2, 1]);
});

test('a replay that is also lost is proven again, and never sent a third time', async () => {
  const landed = scripted({ sends: [LOST, LOST], proofs: ['not-committed', 'committed'], replay: true });
  assert.deepEqual(await performAndProveWrite(landed.write), { kind: 'proven-committed', reason: LOST.reason, attempts: 2 });

  const neverLanded = scripted({ sends: [LOST, LOST, ANSWER], proofs: ['not-committed', 'not-committed'], replay: true });
  await assert.rejects(performAndProveWrite(neverLanded.write), /did not take effect after 2 attempts/);
  assert.equal(neverLanded.sent(), 2);
});

test('an unprovable state is an environment failure with the shared uncertain-outcome wording, and nothing is repeated', async () => {
  const run = scripted({ sends: [LOST, ANSWER], proofs: [new Error('lookup hit a bot-challenge page')], replay: true });

  await assert.rejects(
    performAndProveWrite(run.write),
    (error: Error) => error.message.startsWith(ENVIRONMENT_MARKER) && error.message.includes(UNCERTAIN_ACTION_OUTCOME_ERROR) && error.message.includes('bot-challenge')
  );
  assert.equal(run.sent(), 1);
});
