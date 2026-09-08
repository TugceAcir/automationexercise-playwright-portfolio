import { countE2eCoverage } from '../coverage-counts';
import type { PlaywrightJsonReport } from '../types/playwright-json';
import type { RunScope, RunSummary, ScenarioResult } from './report-model';

export const FAILED_SCENARIO_PENALTY = 12;
export const ENVIRONMENT_SCENARIO_PENALTY = 4;
export const SKIPPED_SCENARIO_PENALTY = 4;

// Portfolio triage score: pass rate with visible penalties for scenarios needing review.
export function calculateConfidenceScore(total: number, passed: number, failed: number, skipped: number, environmentFailed = 0): number {
  const passRate = total === 0 ? 0 : passed / total;
  const reviewFailures = Math.max(0, failed - environmentFailed);

  return Math.max(
    0,
    Math.round(
      passRate * 100 -
        reviewFailures * FAILED_SCENARIO_PENALTY -
        environmentFailed * ENVIRONMENT_SCENARIO_PENALTY -
        skipped * SKIPPED_SCENARIO_PENALTY
    )
  );
}

// Classify against the machine-counted coverage total rather than a hardcoded number,
// so the rule stays correct as the suite grows. The catch matters: this reads the
// filesystem, and a coverage-count failure must never break report generation.
export function resolveRunScope(total: number): RunScope {
  try {
    return total >= countE2eCoverage().browserScenarioExecutions ? 'full-regression' : 'partial';
  } catch {
    return 'partial';
  }
}

export function summarizeRun(report: Pick<PlaywrightJsonReport, 'stats'>, scenarios: ScenarioResult[], generatedAt = new Date().toISOString()): RunSummary {
  const passed = scenarios.filter((scenario) => scenarioStatusGroup(scenario) === 'passed').length;
  const skipped = scenarios.filter((scenario) => scenario.status === 'skipped').length;
  const failed = scenarios.filter((scenario) => !['passed', 'skipped'].includes(scenario.status)).length;
  const environmentFailed = scenarios.filter(
    (scenario) => !['passed', 'skipped'].includes(scenario.status) && scenario.causeGroup === 'environment'
  ).length;
  const flaky = scenarios.filter((scenario) => scenarioStatusGroup(scenario) === 'flaky').length;
  const total = scenarios.length;

  return {
    id: generatedAt.replace(/[:.]/g, '-'),
    generatedAt,
    total,
    passed,
    failed,
    environmentFailed,
    skipped,
    flaky,
    durationMs: report.stats?.duration ?? scenarios.reduce((totalDuration, scenario) => totalDuration + scenario.durationMs, 0),
    confidenceScore: calculateConfidenceScore(total, passed, failed, skipped, environmentFailed),
    scope: resolveRunScope(total),
    scenarios
  };
}

export function scenarioStatusGroup(scenario: ScenarioResult): 'passed' | 'flaky' | 'failed' | 'skipped' {
  if (scenario.status === 'skipped') return 'skipped';
  if (scenario.status === 'passed' && scenario.attempts > 1) return 'flaky';
  if (scenario.status === 'passed') return 'passed';
  return 'failed';
}

// Every scenario lands in exactly one of passed / flaky / failed / skipped above, and
// `summarizeRun` counts four of them, so a recorded run's flaky count is the remainder of
// the other three. That makes it recoverable for history written before `flaky` was
// persisted - derived from stored data, never invented, the same contract `scope` has.
//
// `environmentFailed` is the guard, not decoration. Before commit 67ea314 (2026-07-18,
// which added that field) `failed` was itself computed as `total - passed - skipped`, so
// the remainder was structurally zero however many scenarios had been retry-recovered.
// A row carrying `environmentFailed` was therefore written by code whose counts partition
// exactly; a row without it cannot be vouched for. Returning undefined there keeps it
// reading as "not recorded" rather than a confident zero - the failure mode warning 7
// describes, where a check that returns true too easily is worse than the gap it hides.
export function deriveFlakyCount(run: Partial<Pick<RunSummary, 'total' | 'passed' | 'failed' | 'skipped' | 'environmentFailed'>>): number | undefined {
  const { total, passed, failed, skipped, environmentFailed } = run;
  if (!isCount(total) || !isCount(passed) || !isCount(failed) || !isCount(skipped) || !isCount(environmentFailed)) {
    return undefined;
  }

  const remainder = total - passed - failed - skipped;
  return remainder >= 0 ? remainder : undefined;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
