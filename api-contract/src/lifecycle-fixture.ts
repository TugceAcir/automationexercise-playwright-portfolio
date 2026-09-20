import { join } from 'node:path';
import { test as base } from '@playwright/test';
import { ApiClient } from './client';
import type { WriteResult } from './client';
import { EnvironmentFailure } from './classification';
import { CLEANUP_FILE } from './cleanup-evidence';
import { LifecycleTracker } from './lifecycle-tracker';
import { createGeneratedAccount } from './test-user';
import type { GeneratedAccount } from './test-user';
import { ApiTransport } from './transport';
import { suiteResultsDir } from './suite';

// The lifecycle suite's own fixture. The read suite keeps src/fixture.ts untouched, so nothing
// that writes can leak into the suite that runs automatically after every regression.
//
// Ownership: the factory registers an account before it is created and cleans it up after the
// test, whatever the test did with it. A test that deletes its own account is the normal case,
// not an error - teardown then only has to prove the account is absent.

/** Accounts this test owns. Every one is registered on disk before its create is sent. */
export class GeneratedAccounts {
  private readonly owned: GeneratedAccount[] = [];

  constructor(
    private readonly api: ApiClient,
    private readonly tracker: LifecycleTracker
  ) {}

  /** A registered account that has NOT been created yet. Use when the test sends the create itself. */
  register(): GeneratedAccount {
    const account = createGeneratedAccount();
    this.owned.push(account);
    this.tracker.record(account.email, 'creation-attempted');

    return account;
  }

  /** Register, create, and record that the account now exists. The write's result is returned
   * so a test can assert the documented create response rather than trusting the side effect. */
  async create(): Promise<{ account: GeneratedAccount; result: WriteResult }> {
    const account = this.register();
    const result = await this.api.createAccount(account);
    this.tracker.record(account.email, 'present');

    return { account, result };
  }

  /** Called by the fixture's teardown. Proves every owned account is gone, or reports it as a leftover. */
  async cleanUp(): Promise<void> {
    const leftovers: string[] = [];

    for (const account of this.owned) {
      try {
        if ((await this.api.accountPresence(account.email)) === 'absent') {
          // Either the test deleted it, or the create never landed. Both are proven-clean.
          this.tracker.record(account.email, 'deleted-proven', 'absent at teardown');
          continue;
        }

        await this.api.deleteAccount({ email: account.email, password: account.password });

        if ((await this.api.accountPresence(account.email)) === 'absent') {
          this.tracker.record(account.email, 'deleted-proven', 'deleted at teardown');
          continue;
        }

        this.tracker.record(account.email, 'leftover', 'still present after a delete at teardown');
        leftovers.push(account.email);
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        this.tracker.record(account.email, 'leftover', detail);
        leftovers.push(account.email);
      }
    }

    if (leftovers.length > 0) {
      // An unproven cleanup fails the run on purpose: a leftover account on a shared public site
      // is the one outcome this suite must never report quietly.
      throw new EnvironmentFailure(
        `${leftovers.length} generated account(s) could not be proven deleted: ${leftovers.join(', ')}. Recover with: npm run cleanup:leftovers -- --email <address> --confirm`
      );
    }
  }
}

type LifecycleFixtures = {
  api: ApiClient;
  accounts: GeneratedAccounts;
};

export const test = base.extend<LifecycleFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(new ApiTransport(request)));
  },
  accounts: async ({ api }, use) => {
    const runId = process.env.API_RUN_ID;

    if (!runId) {
      // Without a run ID the cleanup record cannot be tied to this run, and unmatched evidence is
      // reported as unavailable rather than as zero leftovers. Refuse to write accounts at all.
      throw new Error('The lifecycle suite needs API_RUN_ID. Run it with npm run test:lifecycle, which mints one.');
    }

    const accounts = new GeneratedAccounts(api, new LifecycleTracker(join(suiteResultsDir('lifecycle'), CLEANUP_FILE), runId));

    await use(accounts);
    await accounts.cleanUp();
  }
});

export { expect } from '@playwright/test';
