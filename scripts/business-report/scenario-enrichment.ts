import { commandPath, shellQuote } from './commands';
import { gherkinForScenario, missingGherkinForScenario } from './gherkin-templates';
import { scenarioIdForScenario, type ScenarioResult } from './report-model';
import { scenarioStatusGroup } from './scoring';

export type EnrichedScenario = ScenarioResult & {
  statusGroup: 'passed' | 'flaky' | 'failed' | 'skipped';
  command: string;
  gherkin: string;
  csvRow: string;
};

// Convert raw Playwright scenarios into the single shape used by dashboard, CSV, and feature exports.
export function enrichScenarios(scenarios: ScenarioResult[]): { scenarios: EnrichedScenario[]; missingTemplates: string[] } {
  const missingTemplates: string[] = [];
  const enrichedScenarios = scenarios.map((scenario) => {
    const scenarioId = scenarioIdForScenario(scenario);
    const gherkin = gherkinForScenario(scenario);
    if (!gherkin) {
      missingTemplates.push(scenarioId ? `${scenarioId} (${scenario.title})` : `missing scenario ID (${scenario.title})`);
    }

    const enriched = {
      ...scenario,
      statusGroup: scenarioStatusGroup(scenario),
      command: runCommandForScenario(scenario),
      gherkin: gherkin ?? missingGherkinForScenario(scenario, scenarioId)
    };

    return {
      ...enriched,
      csvRow: scenarioCsvRow(enriched)
    };
  });

  return {
    scenarios: enrichedScenarios,
    missingTemplates
  };
}

export function buildGherkinCsv(scenarios: EnrichedScenario[]): string {
  const header = ['Feature', 'Scenario', 'Browser', 'Status', 'Attempts', 'Duration', 'Tags', 'Run Command', 'Gherkin'].map(csvEscape).join(',');
  return [header, ...scenarios.map((scenario) => scenario.csvRow)].join('\n');
}

function runCommandForScenario(scenario: ScenarioResult): string {
  const file = scenario.file ? ` ${shellQuote(commandPath(scenario.file))}` : '';
  const project = ` --project ${shellQuote(scenario.browser)}`;
  const scenarioId = scenarioIdForScenario(scenario);
  const grep = scenarioId ? ` --grep ${shellQuote(`@${scenarioId}`)}` : '';

  return `npx playwright test${file}${project}${grep}`;
}

function scenarioCsvRow(scenario: Omit<EnrichedScenario, 'csvRow'>): string {
  return [
    scenario.feature,
    scenario.title,
    scenario.browser,
    scenario.statusGroup,
    String(scenario.attempts),
    formatDuration(scenario.durationMs),
    scenario.tags.join(' '),
    scenario.command,
    scenario.gherkin
  ].map(csvEscape).join(',');
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
