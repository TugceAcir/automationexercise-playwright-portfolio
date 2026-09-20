import { readFileSync } from 'node:fs';
import { request } from '@playwright/test';
import { resolveBaseUrl } from '../src/base-url';
import { ApiClient } from '../src/client';
import { derivePassword, generatedIdFromEmail } from '../src/test-user';
import { ApiTransport } from '../src/transport';

// Manual recovery for generated accounts a lifecycle run could not prove deleted. Never a CI
// step: CI reports leftovers, a human decides to remove them.
//
//   npm run cleanup:leftovers -- --file results/lifecycle/cleanup.json
//   npm run cleanup:leftovers -- --email api-contract.<uuid>@example.com --confirm
//
// It is a dry run unless --confirm is passed, and it refuses any address that is not one this
// package generates - the password is derived from the address, so an address we did not make
// has no derivable password and is none of this tool's business.

export type CleanupArgs = { file?: string; emails: string[]; confirm: boolean };

export function parseArgs(argv: string[]): CleanupArgs {
  const args: CleanupArgs = { emails: [], confirm: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--confirm') {
      args.confirm = true;
    } else if (argument === '--file') {
      args.file = argv[index + 1];
      index += 1;
    } else if (argument === '--email') {
      const email = argv[index + 1];

      if (email) args.emails.push(email);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}. Use --file <cleanup.json>, --email <address> (repeatable), and --confirm.`);
    }
  }

  if (!args.file && args.emails.length === 0) {
    throw new Error('Nothing to do. Pass --file <cleanup.json> or one or more --email <address>.');
  }

  return args;
}

/** Emails from the record that are not already proven deleted, plus any given with --email. */
export function collectCandidates(args: CleanupArgs, readFile: (path: string) => string = (path) => readFileSync(path, 'utf8')): string[] {
  const candidates = new Set(args.emails);

  if (args.file) {
    // Read loosely here on purpose: this tool exists for the runs whose evidence is imperfect.
    // The run ID is not matched, because a leftover from an earlier run is exactly the target.
    const parsed = JSON.parse(readFile(args.file)) as { accounts?: { email?: unknown; state?: unknown }[] };

    for (const account of parsed.accounts ?? []) {
      if (typeof account.email === 'string' && account.state !== 'deleted-proven') {
        candidates.add(account.email);
      }
    }
  }

  return [...candidates];
}

export type CleanupOutcome = { email: string; outcome: 'refused' | 'absent' | 'would-delete' | 'deleted' | 'unresolved'; detail?: string };

export async function cleanUpAccounts(emails: string[], confirm: boolean, api: ApiClient): Promise<CleanupOutcome[]> {
  const outcomes: CleanupOutcome[] = [];

  for (const email of emails) {
    const id = generatedIdFromEmail(email);

    if (!id) {
      outcomes.push({ email, outcome: 'refused', detail: 'not an address this package generates' });
      continue;
    }

    try {
      if ((await api.accountPresence(email)) === 'absent') {
        outcomes.push({ email, outcome: 'absent' });
        continue;
      }

      if (!confirm) {
        outcomes.push({ email, outcome: 'would-delete', detail: 'dry run; pass --confirm to delete' });
        continue;
      }

      await api.deleteAccount({ email, password: derivePassword(id) });

      if ((await api.accountPresence(email)) === 'absent') {
        outcomes.push({ email, outcome: 'deleted' });
        continue;
      }

      outcomes.push({ email, outcome: 'unresolved', detail: 'still present after a delete' });
    } catch (error: unknown) {
      outcomes.push({ email, outcome: 'unresolved', detail: error instanceof Error ? error.message : String(error) });
    }
  }

  return outcomes;
}

export function renderOutcomes(outcomes: CleanupOutcome[], confirm: boolean): string {
  const lines = [confirm ? 'Cleanup (--confirm: deletions were sent)' : 'Cleanup dry run (nothing was deleted)', ''];

  for (const outcome of outcomes) {
    lines.push(`  ${outcome.outcome.padEnd(13)} ${outcome.email}${outcome.detail ? ` - ${outcome.detail}` : ''}`);
  }

  const unresolved = outcomes.filter((outcome) => outcome.outcome === 'unresolved');
  const pending = outcomes.filter((outcome) => outcome.outcome === 'would-delete');

  lines.push('', `${outcomes.length} address(es): ${outcomes.filter((o) => o.outcome === 'deleted').length} deleted, ${outcomes.filter((o) => o.outcome === 'absent').length} already absent, ${pending.length} awaiting --confirm, ${outcomes.filter((o) => o.outcome === 'refused').length} refused, ${unresolved.length} unresolved.`);

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const emails = collectCandidates(args);

  if (emails.length === 0) {
    console.log('No candidate accounts found. Nothing to clean up.');

    return;
  }

  const context = await request.newContext({ baseURL: resolveBaseUrl() });

  try {
    const outcomes = await cleanUpAccounts(emails, args.confirm, new ApiClient(new ApiTransport(context)));
    console.log(renderOutcomes(outcomes, args.confirm));

    // A dry run that found work to do is not a success either: something is still out there.
    // A refused address is also a non-zero exit, so a typo in a recovery command is not read as
    // "nothing needed doing".
    if (outcomes.some((outcome) => outcome.outcome === 'unresolved' || outcome.outcome === 'would-delete' || outcome.outcome === 'refused')) {
      process.exitCode = 1;
    }
  } finally {
    await context.dispose();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
