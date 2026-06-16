import type { PlaywrightJsonReport } from '../types/playwright-json';
import type { RunSummary, ScenarioResult } from './report-model';

export const FAILED_SCENARIO_PENALTY = 12;
export const SKIPPED_SCENARIO_PENALTY = 4;

// Portfolio triage score: pass rate with visible penalties for scenarios needing review.
export function calculateConfidenceScore(total: number, passed: number, failed: number, skipped: number): number {
  const passRate = total === 0 ? 0 : passed / total;
  return Math.max(0, Math.round(passRate * 100 - failed * FAILED_SCENARIO_PENALTY - skipped * SKIPPED_SCENARIO_PENALTY));
}

export function summarizeRun(report: Pick<PlaywrightJsonReport, 'stats'>, scenarios: ScenarioResult[], generatedAt = new Date().toISOString()): RunSummary {
  const passed = scenarios.filter((scenario) => scenario.status === 'passed').length;
  const skipped = scenarios.filter((scenario) => scenario.status === 'skipped').length;
  const failed = scenarios.length - passed - skipped;
  const total = scenarios.length;

  return {
    id: generatedAt.replace(/[:.]/g, '-'),
    generatedAt,
    total,
    passed,
    failed,
    skipped,
    durationMs: report.stats?.duration ?? scenarios.reduce((totalDuration, scenario) => totalDuration + scenario.durationMs, 0),
    confidenceScore: calculateConfidenceScore(total, passed, failed, skipped),
    scenarios
  };
}

export function scenarioStatusGroup(scenario: ScenarioResult): 'passed' | 'flaky' | 'failed' | 'skipped' {
  if (scenario.status === 'skipped') return 'skipped';
  if (scenario.status === 'passed' && scenario.attempts > 1) return 'flaky';
  if (scenario.status === 'passed') return 'passed';
  return 'failed';
}
