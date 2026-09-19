import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONTRACT_MARKER, ENVIRONMENT_MARKER } from '../src/classification';

// Package-local summary of the API run. It deliberately shares nothing with the UI failure
// triage or business report: its own input, its own output, its own wording.

export const RESULTS_FILE = join(__dirname, '..', 'results', 'results.json');
export const SUMMARY_FILE = join(__dirname, '..', 'results', 'summary.md');

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

export function readSummary(resultsFile = RESULTS_FILE): ApiRunSummary {
  if (!existsSync(resultsFile)) {
    return { resultsFound: false };
  }

  return summarize(JSON.parse(readFileSync(resultsFile, 'utf8')) as JsonReport);
}

export function renderMarkdown(summary: ApiRunSummary): string {
  if (!summary.resultsFound) {
    // Never rendered as zero failures: a missing file means the suite did not report at all.
    return ['## API contract run', '', '**No results file was found.** The API suite did not produce `results/results.json`, so this run has no API evidence. It is not a pass.', ''].join('\n');
  }

  const count = (group: FailureGroup) => summary.failures.filter((failure) => failure.group === group).length;
  const lines = [
    '## API contract run',
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

  return lines.join('\n');
}

if (require.main === module) {
  const markdown = renderMarkdown(readSummary());
  mkdirSync(dirname(SUMMARY_FILE), { recursive: true });
  writeFileSync(SUMMARY_FILE, markdown);
  console.log(markdown);
}
