import { readCleanupEvidence, writeCleanupEvidence } from './cleanup-evidence';
import type { AccountRecord, CleanupState } from './cleanup-evidence';

// The live half of the cleanup record. A row is written BEFORE the create request is sent, so an
// account that is created by a request whose answer never arrives is still on file and still gets
// cleaned up. Every state change is flushed to disk immediately, because the crash this guards
// against is exactly the one that would lose an in-memory list.
//
// One run writes one file. The runner (scripts/run-suite.ts) clears the suite's results folder and
// mints the run ID first, so a file left by an earlier run can never be read as this run's
// evidence. Reloading on construction lets the record survive a Playwright worker restart within
// the same run; the suite is single-worker and not parallel, so there is no writer race.

export class LifecycleTracker {
  private readonly records = new Map<string, AccountRecord>();

  constructor(
    private readonly file: string,
    private readonly runId: string
  ) {
    const existing = readCleanupEvidence(file, runId);

    if (existing.status === 'available') {
      for (const record of existing.evidence.accounts) {
        this.records.set(record.email, record);
      }
    }
  }

  /** Records a state and flushes. Call with 'creation-attempted' before sending the create. */
  record(email: string, state: CleanupState, detail?: string): void {
    this.records.set(email, detail === undefined ? { email, state } : { email, state, detail });
    this.flush();
  }

  get accounts(): AccountRecord[] {
    return [...this.records.values()];
  }

  private flush(): void {
    writeCleanupEvidence(this.file, { runId: this.runId, accounts: this.accounts });
  }
}
