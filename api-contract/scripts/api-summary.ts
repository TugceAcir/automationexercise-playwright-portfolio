import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanupTotals, readCleanupEvidence } from '../src/cleanup-evidence';
import type { CleanupReading } from '../src/cleanup-evidence';
import { CONTRACT_MARKER, ENVIRONMENT_MARKER } from '../src/classification';
import { resolveSuite, suiteResultsDir } from '../src/suite';
import type { Suite } from '../src/suite';
import { RUN_METADATA_FILE } from './run-suite';

// Package-local summary of an API run. It deliberately shares nothing with the UI failure
// triage or business report: its own input, its own output, its own wording.
// Usage: `npm run summary` (read suite) or `npm run summary -- lifecycle`.

export const CLEANUP_FILE = 'cleanup.json';

export type FailureGroup = 'environment' | 'contract' | 'needs review';

export type ApiRunSummary =
  | { resultsFound: false }
  | {
      resultsFound: true;
      passed: number;
      flaky: number;
      failed: number;
      skipped: number;
      failures: { title: string; group: FailureGroup; message: string }[];
    };

type JsonResult = { status?: string; error?: { message?: string } };
type JsonTest = { status?: string; results?: JsonResult[] };
type JsonSpec = { title?: string; tests?: JsonTest[] };
type JsonSuite = { specs?: JsonSpec[]; suites?: JsonSuite[] };
type JsonReport = { suites?: JsonSuite[] };

// Playwright's own assertion errors are contract failures: the API answered with a response code,
// message or content other than the documented one.
const ASSERTION_PATTERN = /expect\(/;

export function classifyFailure(message: string): FailureGroup {
  if (message.includes(ENVIRONMENT_MARKER)) return 'environment';
  if (message.includes(CONTRACT_MARKER) || ASSERTION_PATTERN.test(message)) return 'contract';

  return 'needs review';
}

function* specsOf(suites: JsonSuite[] = []): Generator<JsonSpec> {
  for (const suite of suites) {
    yield* suite.specs ?? [];
    yield* specsOf(suite.suites);
  }
}

// ANSI colour codes survive into the JSON report's error text; strip them for Markdown.
function plain(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

export function summarize(report: JsonReport): ApiRunSummary {
  const summary = { resultsFound: true as const, passed: 0, flaky: 0, failed: 0, skipped: 0, failures: [] as { title: string; group: FailureGroup; message: string }[] };

  for (const spec of specsOf(report.suites)) {
    for (const test of spec.tests ?? []) {
      if (test.status === 'expected') summary.passed += 1;
      else if (test.status === 'flaky') summary.flaky += 1;
      else if (test.status === 'skipped') summary.skipped += 1;
      else {
        summary.failed += 1;
        const message = plain(test.results?.at(-1)?.error?.message ?? 'No error message recorded.');
        summary.failures.push({ title: spec.title ?? '<untitled>', group: classifyFailure(message), message: message.split('\n')[0] });
      }
    }
  }

  return summary;
}

export function readSummary(resultsFile: string): ApiRunSummary {
  if (!existsSync(resultsFile)) {
    return { resultsFound: false };
  }

  return summarize(JSON.parse(readFileSync(resultsFile, 'utf8')) as JsonReport);
}

export function readRunId(resultsDir: string): string | undefined {
  try {
    const metadata = JSON.parse(readFileSync(join(resultsDir, RUN_METADATA_FILE), 'utf8')) as { runId?: unknown };

    return typeof metadata.runId === 'string' ? metadata.runId : undefined;
  } catch {
    return undefined;
  }
}

const SUITE_TITLES: Record<Suite, string> = {
  read: 'API contract run (read-only suite)',
  lifecycle: 'API contract run (account lifecycle suite)'
};

export function renderCleanup(reading: CleanupReading, runId: string | undefined): string[] {
  if (reading.status === 'unavailable') {
    // Never rendered as zero leftovers: unread evidence and a clean run must not look alike.
    return ['### Generated-account cleanup', '', `**Cleanup evidence unavailable:** ${reading.reason}. Leftover accounts cannot be ruled out for this run.`, ''];
  }

  const totals = cleanupTotals(reading.evidence);
  const lines = [
    '### Generated-account cleanup',
    '',
    `Run \`${runId}\`: ${totals.created} account(s) attempted, ${totals.deletedProven} deletion(s) proven, ${totals.leftovers.length} leftover(s).`,
    ''
  ];

  if (totals.leftovers.length > 0) {
    lines.push('**Leftover generated accounts** - recover with `npm run cleanup:leftovers` in `api-contract/`:', '');
    for (const leftover of totals.leftovers) {
      lines.push(`- \`${leftover.email}\` (${leftover.state}${leftover.detail ? `: ${leftover.detail.replace(/\|/g, '\\|')}` : ''})`);
    }
    lines.push('');
  }

  return lines;
}

export function renderMarkdown(summary: ApiRunSummary, suite: Suite = 'read', cleanup?: string[]): string {
  const title = `## ${SUITE_TITLES[suite]}`;

  if (!summary.resultsFound) {
    // Never rendered as zero failures: a missing file means the suite did not report at all.
    return [title, '', '**No results file was found.** The API suite did not produce `results.json`, so this run has no API evidence. It is not a pass.', '', ...(cleanup ?? [])].join('\n');
  }

  const count = (group: FailureGroup) => summary.failures.filter((failure) => failure.group === group).length;
  const lines = [
    title,
    '',
    '| Passed | Flaky | Failed | Skipped |',
    '| ---: | ---: | ---: | ---: |',
    `| ${summary.passed} | ${summary.flaky} | ${summary.failed} | ${summary.skipped} |`,
    '',
    `Failures by cause: environment ${count('environment')}, contract ${count('contract')}, needs review ${count('needs review')}.`,
    ''
  ];

  if (summary.failures.length > 0) {
    lines.push('| Test | Cause | First line of the error |', '| --- | --- | --- |');

    for (const failure of summary.failures) {
      lines.push(`| ${failure.title} | ${failure.group} | ${failure.message.replace(/\|/g, '\\|')} |`);
    }

    lines.push('');
  }

  return [...lines, ...(cleanup ?? [])].join('\n');
}

export function buildSuiteSummary(suite: Suite, resultsDir = suiteResultsDir(suite)): string {
  const summary = readSummary(join(resultsDir, 'results.json'));

  if (suite !== 'lifecycle') {
    return renderMarkdown(summary, suite);
  }

  const runId = readRunId(resultsDir);

  return renderMarkdown(summary, suite, renderCleanup(readCleanupEvidence(join(resultsDir, CLEANUP_FILE), runId), runId));
}

if (require.main === module) {
  const suite = resolveSuite(process.argv[2]);
  const markdown = buildSuiteSummary(suite);
  const summaryFile = join(suiteResultsDir(suite), 'summary.md');
  mkdirSync(dirname(summaryFile), { recursive: true });
  writeFileSync(summaryFile, markdown);
  console.log(markdown);
}
