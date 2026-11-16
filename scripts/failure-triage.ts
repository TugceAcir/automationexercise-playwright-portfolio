import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cleanTitle, extractTags, normalizeFilePath } from './business-report/report-model';
import type { PlaywrightJsonReport, PlaywrightSuite } from './types/playwright-json';
import { classifyFailureCause, type FailureCauseGroup } from '../shared/demo-site-classification';
import {
  DEMO_SITE_SERVER_ERRORS_ANNOTATION,
  describeServerErrors,
  mergeServerErrorCounts,
  parseServerErrorCounts,
  totalServerErrors,
  type ServerErrorCounts
} from '../shared/demo-site-server-errors';

type FailureSummary = {
  suite: string;
  title: string;
  file: string;
  tags: string[];
  status: string;
  browser: string;
  attempts: number;
  causeGroup: FailureCauseGroup;
  // Demo-site 5xx responses across every attempt of this test, from the fixture's annotation.
  serverErrors: ServerErrorCounts;
  signature: string;
  error: string;
  githubRunUrl?: string;
  artifactHint: string;
};

const resultsPath = path.resolve('test-results/results.json');
const outputDir = path.resolve('test-results');
const jsonOutputPath = path.join(outputDir, 'failure-triage.json');
const markdownOutputPath = path.join(outputDir, 'failure-triage.md');

export function readReport(): PlaywrightJsonReport {
  if (!existsSync(resultsPath)) {
    return { suites: [] };
  }

  return JSON.parse(readFileSync(resultsPath, 'utf8')) as PlaywrightJsonReport;
}

export function collectFailures(report: PlaywrightJsonReport): FailureSummary[] {
  const failures: FailureSummary[] = [];

  function visitSuite(suite: PlaywrightSuite, parentTitle = ''): void {
    const suiteTitle = [parentTitle, suite.title].filter(Boolean).join(' > ');

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const finalResult = results.at(-1);
        const failedResults = results.filter((result) => result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted');

        if (!finalResult || finalResult.status === 'passed' || finalResult.status === 'skipped') {
          continue;
        }

        const file = normalizeFilePath(spec.file ?? suite.file ?? '');
        const title = cleanTitle(spec.title);
        const browser = test.projectName ?? 'unknown';
        const error = finalResult.error?.message ?? failedResults.at(-1)?.error?.message ?? 'No error message captured.';
        const causeGroup = classifyFailureCause(error);

        failures.push({
          suite: suiteTitle || 'Unknown suite',
          title,
          file,
          tags: spec.tags ?? extractTags(spec.title),
          status: finalResult.status,
          browser,
          attempts: Math.max(results.length, 1),
          causeGroup,
          serverErrors: mergeServerErrorCounts(...results.map(serverErrorsFor)),
          signature: buildSignature(file, title, browser, error),
          error: trimError(error),
          githubRunUrl: githubRunUrl(),
          artifactHint: 'Download Playwright report, test-results, and business-report artifacts from the GitHub Actions run.'
        });
      }
    }

    for (const child of suite.suites ?? []) {
      visitSuite(child, suiteTitle);
    }
  }

  for (const suite of report.suites ?? []) {
    visitSuite(suite);
  }

  return failures;
}

export function writeOutputs(failures: FailureSummary[]): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(jsonOutputPath, JSON.stringify({ generatedAt: new Date().toISOString(), failures }, null, 2), 'utf8');
  writeFileSync(markdownOutputPath, renderMarkdown(failures), 'utf8');
}

export function renderMarkdown(failures: FailureSummary[]): string {
  if (!failures.length) {
    return '# Failure Triage\n\nNo confirmed failed scenarios were found in the latest Playwright JSON report.\n';
  }

  const environmentFailures = failures.filter((failure) => failure.causeGroup === 'environment').length;
  const needsReviewFailures = failures.length - environmentFailures;
  const summary = verdict(failures);

  return [
    '# Failure Triage',
    '',
    `**${summary.title}.** ${summary.message}`,
    '',
    `Confirmed failures: ${failures.length} (${environmentFailures} likely environment, ${needsReviewFailures} need review)`,
    '',
    'Classification comes from the error each test raised. The 5xx counts are the HTTP server errors the demo site returned while that test ran, across all of its attempts.',
    '',
    ...failures.map((failure, index) =>
      [
        `## ${index + 1}. ${failure.title}`,
        '',
        `- Suite: ${failure.suite}`,
        `- File: ${failure.file}`,
        `- Browser: ${failure.browser}`,
        `- Status: ${failure.status}`,
        `- Attempts: ${failure.attempts}`,
        `- Cause group: ${failure.causeGroup}`,
        `- Demo-site 5xx responses: ${describeServerErrors(failure.serverErrors)}`,
        `- Tags: ${failure.tags.join(' ') || 'none'}`,
        `- Signature: ${failure.signature}`,
        failure.githubRunUrl ? `- GitHub run: ${failure.githubRunUrl}` : undefined,
        `- Artifact hint: ${failure.artifactHint}`,
        '',
        '```text',
        failure.error,
        '```',
        ''
      ]
        .filter(Boolean)
        .join('\n')
    )
  ].join('\n');
}

type Verdict = { level: 'warning' | 'error'; title: string; message: string };

// One sentence a reader can act on without opening any artifact. A run is called
// environment-only only when every failure matched a known demo-site signature; any
// other failure makes the whole run "needs review", whatever the 5xx count says.
export function verdict(failures: FailureSummary[]): Verdict {
  const serverErrors = mergeServerErrorCounts(...failures.map((failure) => failure.serverErrors));
  const evidence = totalServerErrors(serverErrors)
    ? ` The demo site returned ${describeServerErrors(serverErrors)} HTTP 5xx responses during the failed tests.`
    : '';
  const review = failures.filter((failure) => failure.causeGroup !== 'environment');

  if (!review.length) {
    return {
      level: 'warning',
      title: 'Demo site unavailable',
      message: `All ${failures.length} failure(s) match known outage signatures of the public demo site (server error, queue-full or bot-challenge pages). No product or test-code failure was detected.${evidence}`
    };
  }

  const names = review.map((failure) => `${failure.title} [${failure.browser}]`).join('; ');
  return {
    level: 'error',
    title: 'Failures need review',
    message: `${review.length} of ${failures.length} failure(s) did not match a known demo-site outage signature: ${names}.${evidence}`
  };
}

// GitHub workflow command, shown at the top of the run page. % and newlines must be escaped.
export function githubAnnotation(failures: FailureSummary[]): string | undefined {
  if (!failures.length) return undefined;

  const { level, title, message } = verdict(failures);
  const escape = (text: string) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return `::${level} title=${escape(title).replace(/:/g, '%3A').replace(/,/g, '%2C')}::${escape(message)}`;
}

function serverErrorsFor(result: { annotations?: { type: string; description?: string }[] }): ServerErrorCounts {
  return mergeServerErrorCounts(
    ...(result.annotations ?? [])
      .filter((annotation) => annotation.type === DEMO_SITE_SERVER_ERRORS_ANNOTATION)
      .map((annotation) => parseServerErrorCounts(annotation.description))
  );
}

function buildSignature(file: string, title: string, browser: string, error: string): string {
  const firstErrorLine = error.split('\n').find(Boolean) ?? 'unknown-error';
  return `${file}::${title}::${browser}::${firstErrorLine}`.toLowerCase().replace(/\s+/g, '-').slice(0, 180);
}

function trimError(error: string): string {
  return error.split('\n').slice(0, 12).join('\n');
}

function githubRunUrl(): string | undefined {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;

  if (!serverUrl || !repository || !runId) {
    return undefined;
  }

  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

export function runFailureTriage(): void {
  const failures = collectFailures(readReport());
  writeOutputs(failures);
  console.log(`Failure triage written for ${failures.length} confirmed failure(s).`);

  const annotation = githubAnnotation(failures);
  if (annotation && process.env.GITHUB_ACTIONS === 'true') {
    console.log(annotation);
  }
}

if (require.main === module) {
  runFailureTriage();
}
