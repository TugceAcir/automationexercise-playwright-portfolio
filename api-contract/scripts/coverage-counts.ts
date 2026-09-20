import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SUITES, SUITE_TAGS } from '../src/suite';
import type { Suite } from '../src/suite';

// Owns the <!-- api-coverage:... --> blocks in README.md and AGENTS.md. The root generator
// (scripts/coverage-counts.ts) owns the UI <!-- coverage:... --> blocks; neither touches the
// other's markers, so the UI 69/207 figures cannot move because of an API change.
//
// Counts come from Playwright's own `--list`, not from counting `test(` calls in the source:
// tests/api/unsupported-methods.spec.ts declares three tests from one call inside a loop, so a
// source count would under-report. Listing sends no requests.

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..');
const readmePath = path.join(repoRoot, 'README.md');
const agentsPath = path.join(repoRoot, 'AGENTS.md');
const MARKER = 'api-coverage';
const ID_PATTERN = /@API\d{3}\b/g;

const areaNames: Record<string, string> = {
  'account-lookup.spec.ts': 'Account Lookup',
  'catalog.spec.ts': 'Catalog',
  'search.spec.ts': 'Product Search',
  'login-check.spec.ts': 'Login Check',
  'unsupported-methods.spec.ts': 'Unsupported Methods',
  'account-lifecycle.spec.ts': 'Account Lifecycle'
};

export type ListedTest = { suite: Suite; file: string; title: string };

export type ApiCoverageSummary = {
  areas: { file: string; name: string; tests: number }[];
  totalScenarios: number;
  readScenarios: number;
  lifecycleScenarios: number;
};

type ListSuite = { specs?: { file: string; title: string; tests: unknown[] }[]; suites?: ListSuite[] };

export function parseListReport(report: { suites?: ListSuite[]; errors?: { message?: string }[] }, suite: Suite = 'read'): ListedTest[] {
  if (report.errors?.length) {
    throw new Error(`playwright --list reported errors: ${report.errors.map((error) => error.message).join('; ')}`);
  }

  const tests: ListedTest[] = [];
  const walk = (suites: ListSuite[] = []) => {
    for (const listed of suites) {
      for (const spec of listed.specs ?? []) {
        for (let i = 0; i < spec.tests.length; i += 1) tests.push({ suite, file: path.basename(spec.file), title: spec.title });
      }
      walk(listed.suites);
    }
  };
  walk(report.suites);

  return tests;
}

export function summarizeApiCoverage(tests: ListedTest[]): ApiCoverageSummary {
  const seen = new Map<string, string>();

  for (const test of tests) {
    const ids = test.title.match(ID_PATTERN) ?? [];

    if (ids.length !== 1) {
      throw new Error(`Every API test needs exactly one @API### ID; found ${ids.length} in "${test.title}".`);
    }

    if (seen.has(ids[0])) {
      throw new Error(`Duplicate test ID ${ids[0]}: "${seen.get(ids[0])}" and "${test.title}".`);
    }

    seen.set(ids[0], test.title);

    // Exactly one ownership tag, and it must match the suite the test runs in: a write test in
    // the read suite would run after every regression, which is what the split exists to stop.
    const words = test.title.split(/\s+/);
    const ownership = (['@read', '@write'] as const).filter((tag) => words.includes(tag));

    if (ownership.length !== 1) {
      throw new Error(`Every API test needs exactly one of @read or @write; found ${ownership.length} in "${test.title}".`);
    }

    if (ownership[0] !== SUITE_TAGS[test.suite]) {
      throw new Error(`"${test.title}" is tagged ${ownership[0]} but lives in the ${test.suite} suite, which requires ${SUITE_TAGS[test.suite]}.`);
    }
  }

  const files = [...new Set(tests.map((test) => test.file))].sort();

  return {
    areas: files.map((file) => ({ file, name: areaNames[file] ?? file.replace(/\.spec\.ts$/, ''), tests: tests.filter((test) => test.file === file).length })),
    totalScenarios: tests.length,
    readScenarios: tests.filter((test) => test.suite === 'read').length,
    lifecycleScenarios: tests.filter((test) => test.suite === 'lifecycle').length
  };
}

export function renderApiCoverageBlock(summary: ApiCoverageSummary): string {
  // Until lifecycle tests exist, the wording stays exactly the read-only wording already public.
  const headline =
    summary.lifecycleScenarios === 0
      ? `Last generated API contract snapshot: ${summary.readScenarios} read-only scenarios in one non-browser project, so each run executes ${summary.readScenarios}. These are not part of the UI browser-scenario totals.`
      : `Last generated API contract snapshot: ${summary.totalScenarios} scenarios in two non-browser suites - ${summary.readScenarios} read-only, and ${summary.lifecycleScenarios} account-lifecycle scenarios that write only to generated accounts. These are not part of the UI browser-scenario totals.`;

  return [headline, '', '| API Area | Tests |', '| --- | ---: |', ...summary.areas.map((area) => `| ${area.name} | ${area.tests} |`)].join('\n');
}

function listTests(suite: Suite): ListedTest[] {
  const cli = require.resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, API_SUITE: suite }
  });
  const report = result.stdout ? (JSON.parse(result.stdout) as Parameters<typeof parseListReport>[0]) : undefined;

  // A suite with no tests yet lists as an error with no tests; that is zero, not a failure.
  if (report && result.status !== 0 && isNoTestsFound(report)) {
    return [];
  }

  if (result.status !== 0 || !report) {
    throw new Error(`playwright test --list for the ${suite} suite failed (exit ${result.status}): ${result.stderr}`);
  }

  return parseListReport(report, suite);
}

export function isNoTestsFound(report: { suites?: ListSuite[]; errors?: { message?: string }[] }): boolean {
  return (report.suites ?? []).length === 0 && (report.errors ?? []).length > 0 && (report.errors ?? []).every((error) => /No tests found/i.test(error.message ?? ''));
}

export function replaceMarkedBlock(content: string, replacement: string): string {
  const start = `<!-- ${MARKER}:start -->`;
  const end = `<!-- ${MARKER}:end -->`;

  if (!content.includes(start) || !content.includes(end)) {
    throw new Error(`Missing ${MARKER} markers.`);
  }

  return content.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => `${start}\n${replacement}\n${end}`);
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function updateFile(filePath: string, block: string, checkOnly: boolean): boolean {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const current = readFileSync(filePath, 'utf8');
  const next = replaceMarkedBlock(current, block);
  const changed = normalizeLineEndings(current) !== normalizeLineEndings(next);

  if (changed && !checkOnly) {
    writeFileSync(filePath, next, 'utf8');
  }

  return changed;
}

export function runApiCoverageCounts(args = process.argv.slice(2)): void {
  const checkOnly = args.includes('--check');
  const summary = summarizeApiCoverage(SUITES.flatMap((suite) => listTests(suite)));
  const block = renderApiCoverageBlock(summary);
  const changed = [updateFile(readmePath, block, checkOnly), updateFile(agentsPath, block, checkOnly)].some(Boolean);

  if (checkOnly && changed) {
    throw new Error('Generated API coverage counts are out of date. Run npm run coverage:counts in api-contract/.');
  }

  console.log(`API coverage counts ${checkOnly ? 'checked' : 'updated'}: ${summary.totalScenarios} scenarios.`);
}

if (require.main === module) {
  try {
    runApiCoverageCounts();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
