import type { RunSummary } from './report-model';

// history.json lives in no git repository. Its only two copies are the Actions cache,
// which GitHub evicts after 7 days, and the published Pages dashboard - and the
// full-regression cron interval is also 7 days, so the two have repeatedly sat on the
// same boundary. This module recovers the file when the cache misses.
//
// Everything here is pure: both histories arrive as arguments and the payload arrives
// as a string, so the fetch and the disk writes stay in scripts/restore-history.ts and
// these rules can be unit-tested without a network or a fixture file. Same split as
// `deriveFlakyCount` and `appendHistory`.

// Matches the cap `appendHistory` applies, so a merge can never grow the file past the
// size a normal run would leave it at. Imported by both, so the number has one home.
export const HISTORY_LIMIT = 30;

// Union rather than "pick the fresher source". A cache restored through `restore-keys`
// is matched by PREFIX, so a hit returns some matching cache and is not provably the
// newest one - and in the eviction case this whole module exists for, an older
// surviving entry would silently drop rows the published copy still has. Merging is
// lossless in both directions and needs no freshness assumption at all.
//
// `id` is the run's generated timestamp and unique per run, so the union cannot
// duplicate a run both sources happen to hold. Where they do, the row carrying
// scenarios wins: every row but the newest is stripped to `scenarios: []` on write, so
// only one copy can still hold them and it is the one `readLatestSavedRun` needs.
export function mergeHistories(cached: RunSummary[], published: RunSummary[]): RunSummary[] {
  const byId = new Map<string, RunSummary>();

  for (const run of [...published, ...cached]) {
    const existing = byId.get(run.id);
    byId.set(run.id, existing ? richerRow(existing, run) : run);
  }

  return [...byId.values()].sort(byGeneratedAt).slice(-HISTORY_LIMIT);
}

// Rejects anything that is not recognisably a history file. A cache miss combined with
// a 404 HTML body would otherwise be parsed as "no runs ever happened" and republish
// the dashboard with a trend of one - the exact silent reset this module prevents.
// Returns undefined rather than an empty array so the caller can tell "not history"
// from "history with no rows": those are different claims and must not be handled alike.
export function parseHistoryPayload(raw: string): RunSummary[] | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) return undefined;
  return parsed.every(isHistoryRow) ? (parsed as RunSummary[]) : undefined;
}

// Deliberately checks the fields the trend and the dashboard actually read. `flaky` and
// `scope` are not required: rows predating those fields are legitimate history and
// `readHistory()` backfills them.
function isHistoryRow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === 'string' &&
    row.id.length > 0 &&
    typeof row.generatedAt === 'string' &&
    !Number.isNaN(Date.parse(row.generatedAt)) &&
    isCount(row.total) &&
    isCount(row.passed) &&
    isCount(row.failed) &&
    isCount(row.skipped)
  );
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Oldest first, matching the order appendHistory writes and readHistory expects.
// `id` breaks ties so the order stays stable for rows generated in the same millisecond.
function byGeneratedAt(a: RunSummary, b: RunSummary): number {
  const difference = Date.parse(a.generatedAt) - Date.parse(b.generatedAt);
  if (difference !== 0) return difference;
  return a.id.localeCompare(b.id);
}

function richerRow(a: RunSummary, b: RunSummary): RunSummary {
  return (b.scenarios?.length ?? 0) > (a.scenarios?.length ?? 0) ? b : a;
}
