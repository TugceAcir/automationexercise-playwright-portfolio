import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSuiteSummary, renderCleanup } from '../../scripts/api-summary';
import { cleanupTotals, readCleanupEvidence, writeCleanupEvidence } from '../../src/cleanup-evidence';
import { createGeneratedAccount, derivePassword, generatedIdFromEmail } from '../../src/test-user';
import { resolveSuite } from '../../src/suite';

const RUN = 'run-2026-09-19';
const EVIDENCE = {
  runId: RUN,
  accounts: [
    { email: 'api-contract.a@example.com', state: 'deleted-proven' as const },
    { email: 'api-contract.b@example.com', state: 'creation-attempted' as const, detail: 'create answer lost; lookup hit a bot page' },
    { email: 'api-contract.c@example.com', state: 'present' as const }
  ]
};

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'api-cleanup-'));
}

test('evidence written for this run is read back, and anything not proven deleted is a leftover', () => {
  const file = path.join(tempDir(), 'cleanup.json');
  writeCleanupEvidence(file, EVIDENCE);

  const reading = readCleanupEvidence(file, RUN);

  assert.equal(reading.status, 'available');
  if (reading.status !== 'available') return;
  const totals = cleanupTotals(reading.evidence);
  assert.deepEqual([totals.created, totals.deletedProven], [3, 1]);
  assert.deepEqual(totals.leftovers.map((account) => account.email), ['api-contract.b@example.com', 'api-contract.c@example.com']);
});

test('missing, malformed, foreign-run or run-less evidence is unavailable - never zero leftovers', () => {
  const dir = tempDir();
  const malformed = path.join(dir, 'malformed.json');
  const wrongShape = path.join(dir, 'shape.json');
  const withPassword = path.join(dir, 'password.json');
  const foreign = path.join(dir, 'foreign.json');
  writeFileSync(malformed, '{"runId": "run-2026-09-19", "accounts": [');
  writeFileSync(wrongShape, JSON.stringify({ runId: RUN, accounts: [{ email: 'x', state: 'gone' }] }));
  writeFileSync(withPassword, JSON.stringify({ runId: RUN, accounts: [{ email: 'x', state: 'present', password: 'secret' }] }));
  writeCleanupEvidence(foreign, { ...EVIDENCE, runId: 'an-earlier-run' });

  const reasons = [
    readCleanupEvidence(path.join(dir, 'absent.json'), RUN),
    readCleanupEvidence(malformed, RUN),
    readCleanupEvidence(wrongShape, RUN),
    readCleanupEvidence(withPassword, RUN),
    readCleanupEvidence(foreign, RUN),
    readCleanupEvidence(foreign, undefined)
  ].map((reading) => (reading.status === 'unavailable' ? reading.reason : 'AVAILABLE'));

  assert.equal(reasons.includes('AVAILABLE'), false);
  assert.match(reasons[0], /no cleanup record/);
  assert.match(reasons[1], /not valid JSON/);
  assert.match(reasons[4], /belongs to run an-earlier-run/);
  assert.match(reasons[5], /no run ID/);
});

test('a password can never be written into the evidence', () => {
  assert.throws(() => writeCleanupEvidence(path.join(tempDir(), 'c.json'), { runId: RUN, accounts: [{ email: 'x', state: 'present', password: 'p' } as never] }));
});

test('the cleanup section lists every leftover email for the job summary, and says so plainly when evidence is unavailable', () => {
  const available = renderCleanup({ status: 'available', evidence: EVIDENCE }, RUN).join('\n');
  const unavailable = renderCleanup({ status: 'unavailable', reason: 'no cleanup record at x' }, RUN).join('\n');

  assert.match(available, /3 account\(s\) attempted, 1 deletion\(s\) proven, 2 leftover\(s\)/);
  assert.match(available, /`api-contract\.b@example\.com` \(creation-attempted: create answer lost/);
  assert.match(available, /npm run cleanup:leftovers/);
  assert.match(unavailable, /Cleanup evidence unavailable/);
  assert.doesNotMatch(unavailable, /0 leftover/);
});

test('a lifecycle summary with no results and no evidence reports both as missing', () => {
  const markdown = buildSuiteSummary('lifecycle', tempDir());

  assert.match(markdown, /account lifecycle suite/);
  assert.match(markdown, /No results file was found/);
  assert.match(markdown, /\*\*Cleanup evidence unavailable:\*\* the current run has no run ID/);
});

test('generated accounts are recognisable, and the password is recoverable from the email alone', () => {
  const account = createGeneratedAccount();
  const again = createGeneratedAccount(account.id);

  assert.match(account.email, /^api-contract\.[0-9a-f-]{36}@example\.com$/);
  assert.equal(generatedIdFromEmail(account.email), account.id);
  assert.equal(derivePassword(generatedIdFromEmail(account.email) as string), account.password);
  assert.equal(again.password, account.password);
  assert.notEqual(createGeneratedAccount().password, account.password);
  // Anything this package did not generate is refused, so cleanup can never touch another account.
  assert.equal(generatedIdFromEmail('qa.portfolio.123@example.com'), undefined);
  assert.equal(generatedIdFromEmail(`${account.email}.evil.com`), undefined);
});

test('the suite defaults to read-only and rejects anything unknown', () => {
  assert.equal(resolveSuite(undefined), 'read');
  assert.equal(resolveSuite('lifecycle'), 'lifecycle');
  assert.throws(() => resolveSuite('all'), /must be one of read, lifecycle/);
});
