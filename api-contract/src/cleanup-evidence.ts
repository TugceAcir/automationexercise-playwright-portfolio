import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

// The record of every generated account a lifecycle run touched. It is written before each
// create is sent and after every state change, so a crash still leaves the email behind. It
// never holds a password: those are derived from the email (src/test-user.ts).
//
// Reading it is strict on purpose. Evidence that is missing, malformed, or from another run is
// "unavailable" - never zero leftovers - because an empty list and an unread list look the same.

/** The record's filename inside a lifecycle run's results folder. */
export const CLEANUP_FILE = 'cleanup.json';

export const CLEANUP_STATES = ['creation-attempted', 'present', 'deleted-proven', 'leftover'] as const;
export type CleanupState = (typeof CLEANUP_STATES)[number];

const accountRecordSchema = z.strictObject({
  email: z.string().min(1),
  state: z.enum(CLEANUP_STATES),
  detail: z.string().optional()
});

const cleanupEvidenceSchema = z.strictObject({
  runId: z.string().min(1),
  accounts: z.array(accountRecordSchema)
});

export type CleanupEvidence = z.infer<typeof cleanupEvidenceSchema>;
export type AccountRecord = z.infer<typeof accountRecordSchema>;

export type CleanupReading =
  | { status: 'available'; evidence: CleanupEvidence }
  | { status: 'unavailable'; reason: string };

export function readCleanupEvidence(file: string, expectedRunId: string | undefined): CleanupReading {
  if (!expectedRunId) {
    return { status: 'unavailable', reason: 'the current run has no run ID to match the evidence against' };
  }

  if (!existsSync(file)) {
    return { status: 'unavailable', reason: `no cleanup record at ${file}` };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { status: 'unavailable', reason: 'the cleanup record is not valid JSON' };
  }

  const result = cleanupEvidenceSchema.safeParse(parsed);

  if (!result.success) {
    return { status: 'unavailable', reason: `the cleanup record does not match its format (${result.error.issues[0]?.message ?? 'unknown issue'})` };
  }

  if (result.data.runId !== expectedRunId) {
    return { status: 'unavailable', reason: `the cleanup record belongs to run ${result.data.runId}, not the current run ${expectedRunId}` };
  }

  return { status: 'available', evidence: result.data };
}

export type CleanupTotals = { created: number; deletedProven: number; leftovers: AccountRecord[] };

/** Anything not proven deleted is a leftover, including an attempt whose outcome was never settled. */
export function cleanupTotals(evidence: CleanupEvidence): CleanupTotals {
  return {
    created: evidence.accounts.length,
    deletedProven: evidence.accounts.filter((account) => account.state === 'deleted-proven').length,
    leftovers: evidence.accounts.filter((account) => account.state !== 'deleted-proven')
  };
}

/** Writes through a temporary file, so a crash mid-write cannot leave a half-written record. */
export function writeCleanupEvidence(file: string, evidence: CleanupEvidence): void {
  const valid = cleanupEvidenceSchema.parse(evidence);
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(valid, null, 2)}\n`);
  renameSync(temporary, file);
}
