import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type PlaywrightJsonReport = {
  suites?: PlaywrightSuite[];
};

type PlaywrightSuite = {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};

type PlaywrightSpec = {
  title: string;
  tags?: string[];
  file?: string;
  tests?: PlaywrightTest[];
};

type PlaywrightTest = {
  results?: PlaywrightResult[];
};

type PlaywrightResult = {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  retry?: number;
  error?: {
    message?: string;
  };
};

type FailureSummary = {
  suite: string;
  title: string;
  file: string;
  tags: string[];
  status: string;
  attempts: number;
  flaky: boolean;
  signature: string;
  error: string;
  githubRunUrl?: string;
  artifactHint: string;
};

const resultsPath = path.resolve('test-results/results.json');
const outputDir = path.resolve('test-results');
const jsonOutputPath = path.join(outputDir, 'failure-triage.json');
const markdownOutputPath = path.join(outputDir, 'failure-triage.md');

function readReport(): PlaywrightJsonReport {
  if (!existsSync(resultsPath)) {
    return { suites: [] };
  }

  return JSON.parse(readFileSync(resultsPath, 'utf8')) as PlaywrightJsonReport;
}

function collectFailures(report: PlaywrightJsonReport): FailureSummary[] {
  const failures: FailureSummary[] = [];

  function visitSuite(suite: PlaywrightSuite, parentTitle = ''): void {
    const suiteTitle = [parentTitle, suite.title].filter(Boolean).join(' > ');

    for (const spec of suite.specs ?? []) {
      const results = spec.tests?.[0]?.results ?? [];
      const finalResult = results.at(-1);
      const failedResults = results.filter((result) => result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted');

      if (!finalResult || finalResult.status === 'passed' || finalResult.status === 'skipped') {
        continue;
      }

      const file = normalizeFilePath(spec.file ?? suite.file ?? '');
      const title = cleanTitle(spec.title);
      const error = finalResult.error?.message ?? failedResults.at(-1)?.error?.message ?? 'No error message captured.';

      failures.push({
        suite: suiteTitle || 'Unknown suite',
        title,
        file,
        tags: spec.tags ?? extractTags(spec.title),
        status: finalResult.status,
        attempts: Math.max(results.length, 1),
        flaky: false,
        signature: buildSignature(file, title, error),
        error: trimError(error),
        githubRunUrl: githubRunUrl(),
        artifactHint: 'Download Playwright report, test-results, and business-report artifacts from the GitHub Actions run.'
      });
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

function writeOutputs(failures: FailureSummary[]): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(jsonOutputPath, JSON.stringify({ generatedAt: new Date().toISOString(), failures }, null, 2), 'utf8');
  writeFileSync(markdownOutputPath, renderMarkdown(failures), 'utf8');
}

function renderMarkdown(failures: FailureSummary[]): string {
  if (!failures.length) {
    return '# Failure Triage\n\nNo confirmed failed scenarios were found in the latest Playwright JSON report.\n';
  }

  return [
    '# Failure Triage',
    '',
    `Confirmed failures: ${failures.length}`,
    '',
    ...failures.map((failure, index) =>
      [
        `## ${index + 1}. ${failure.title}`,
        '',
        `- Suite: ${failure.suite}`,
        `- File: ${failure.file}`,
        `- Status: ${failure.status}`,
        `- Attempts: ${failure.attempts}`,
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

function buildSignature(file: string, title: string, error: string): string {
  const firstErrorLine = error.split('\n').find(Boolean) ?? 'unknown-error';
  return `${file}::${title}::${firstErrorLine}`.toLowerCase().replace(/\s+/g, '-').slice(0, 180);
}

function trimError(error: string): string {
  return error.split('\n').slice(0, 12).join('\n');
}

function cleanTitle(title: string): string {
  return title.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();
}

function extractTags(title: string): string[] {
  return title.match(/@\w+/g) ?? [];
}

function normalizeFilePath(file: string): string {
  return file.replaceAll('\\', '/');
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

const failures = collectFailures(readReport());
writeOutputs(failures);
console.log(`Failure triage written for ${failures.length} confirmed failure(s).`);
