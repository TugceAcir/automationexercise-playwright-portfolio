import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HISTORY_LIMIT, mergeHistories, parseHistoryPayload } from './business-report/history-recovery';
import type { RunSummary } from './business-report/report-model';

// Runs in CI immediately after the Actions cache restore, before any test executes.
//
// business-report/history.json is the only irreplaceable asset in this repo: it is
// gitignored, so its copies are the Actions cache (7-day TTL) and the published Pages
// dashboard, and the full-regression cron is also 7 days. When the cache misses, this
// recovers the published copy so the dashboard trend survives instead of silently
// restarting at one.
//
// The decision it emits matters as much as the file it writes. If history cannot be
// established the run still proceeds - those test results are legitimate evidence - but
// `history_trusted=false` tells the workflow to skip publishing, so the last good
// dashboard is preserved rather than overwritten with a reset one.

const reportDir = path.resolve('business-report');
const historyPath = path.join(reportDir, 'history.json');
const publishedUrl = process.env.PUBLISHED_HISTORY_URL
  ?? 'https://TugceAcir.github.io/automationexercise-playwright-portfolio/history.json';

type Outcome = { trusted: boolean; reason: string };

async function restoreHistory(): Promise<Outcome> {
  const cached = readCachedHistory();
  const published = await fetchPublishedHistory();

  if (cached === undefined && published === undefined) {
    // Nothing on disk and nothing recoverable. Genuinely ambiguous: this is either the
    // very first run or a fetch that failed, and those must not be treated alike.
    return { trusted: false, reason: 'no cached history and the published copy could not be read' };
  }

  if (published === 'absent' && cached === undefined) {
    // A 404 is a definite answer, not a failure: no dashboard has ever been published,
    // so an empty history is the truth rather than a loss.
    return { trusted: true, reason: 'no history exists yet - nothing published and nothing cached' };
  }

  const publishedRows = published === 'absent' || published === undefined ? [] : published;
  const cachedRows = cached ?? [];

  if (published === undefined && cached !== undefined) {
    // The cache carries history, so the run is trustworthy even though the published
    // copy could not be read. Nothing to merge; leave the file exactly as restored.
    return { trusted: true, reason: `kept ${cachedRows.length} cached rows; published copy unreadable` };
  }

  const merged = mergeHistories(cachedRows, publishedRows);
  writeHistory(merged);

  const recovered = merged.length - cachedRows.length;
  return {
    trusted: true,
    reason: `merged ${cachedRows.length} cached + ${publishedRows.length} published into ${merged.length} rows`
      + (recovered > 0 ? ` (recovered ${recovered})` : '')
  };
}

function readCachedHistory(): RunSummary[] | undefined {
  if (!existsSync(historyPath)) return undefined;

  const rows = parseHistoryPayload(readFileSync(historyPath, 'utf8'));
  if (!rows) {
    console.warn('Cached history.json is present but not valid history; ignoring it.');
    return undefined;
  }

  return rows;
}

// 'absent' is a distinct answer from undefined: 404 means no dashboard has been
// published, while undefined means the answer could not be obtained.
async function fetchPublishedHistory(): Promise<RunSummary[] | 'absent' | undefined> {
  try {
    const response = await fetch(publishedUrl, { signal: AbortSignal.timeout(30_000) });

    if (response.status === 404) return 'absent';
    if (!response.ok) {
      console.warn(`Published history responded ${response.status}.`);
      return undefined;
    }

    const rows = parseHistoryPayload(await response.text());
    if (!rows) {
      // Most likely an error page served with a 200, which JSON.parse would reject and
      // a laxer check would happily read as "zero runs".
      console.warn('Published history did not parse as a history file.');
      return undefined;
    }

    return rows;
  } catch (error) {
    console.warn(`Could not fetch published history: ${(error as Error).message}`);
    return undefined;
  }
}

function writeHistory(history: RunSummary[]): void {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

function report(outcome: Outcome): void {
  console.log(`History ${outcome.trusted ? 'established' : 'NOT established'}: ${outcome.reason}`);
  console.log(`Cap: ${HISTORY_LIMIT} rows.`);

  if (!outcome.trusted) {
    console.log('Publishing will be skipped so the last good dashboard is preserved.');
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `history_trusted=${outcome.trusted}\n`, 'utf8');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `- Business report history: ${outcome.trusted ? 'established' : '**not established - dashboard will not be republished**'} (${outcome.reason})\n`,
      'utf8'
    );
  }
}

// Never fails the run. A history problem must not be reported as a test failure, and the
// suite's results are worth collecting either way - the publish gate is what protects
// the dashboard.
restoreHistory()
  .then(report)
  .catch((error: unknown) => {
    report({ trusted: false, reason: `unexpected error: ${(error as Error).message}` });
  });
