import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PlaywrightJsonReport, PlaywrightSuite } from '../types/playwright-json';
import { commandPath, shellQuote } from './commands';
import { cleanTitle, extractTags, featureFromFile, isScenarioIdTag, normalizeFilePath, type RunSummary, type ScenarioResult } from './report-model';
import { buildGherkinCsv, enrichScenarios, type EnrichedScenario } from './scenario-enrichment';
import { FAILED_SCENARIO_PENALTY, SKIPPED_SCENARIO_PENALTY, summarizeRun } from './scoring';

type BusinessReportOptions = {
  strictGherkin?: boolean;
};

const resultsPath = path.resolve('test-results/results.json');
const reportDir = path.resolve('business-report');
const historyPath = path.join(reportDir, 'history.json');
const htmlPath = path.join(reportDir, 'index.html');
const gherkinCsvPath = path.join(reportDir, 'gherkin-cases.csv');
const gherkinFeaturePath = path.join(reportDir, 'gherkin-cases.feature');

// Keep this file as orchestration; scoring, Gherkin, and enrichment rules live in focused modules.
export async function buildBusinessReport(): Promise<void> {
  mkdirSync(reportDir, { recursive: true });

  const report = readJsonReport();
  const scenarios = flattenScenarios(report);
  const latestSavedRun = readLatestSavedRun();
  if (!scenarios.length && latestSavedRun) {
    writeBusinessReport(latestSavedRun, { strictGherkin: true });
    return;
  }

  const summary = summarizeRun(report, scenarios);
  writeBusinessReport(summary, { strictGherkin: true });
}

export function writeBusinessReport(summary: RunSummary, options: BusinessReportOptions = {}): void {
  mkdirSync(reportDir, { recursive: true });

  const { scenarios: enrichedScenarios, missingTemplates } = enrichScenarios(summary.scenarios);
  if (missingTemplates.length) {
    const message = [
      'Missing business Gherkin templates for scenario IDs:',
      ...missingTemplates.map((template) => `- ${template}`)
    ].join('\n');

    if (options.strictGherkin ?? true) {
      throw new Error(message);
    }

    console.warn(message);
  }

  const history = appendHistory(summary);
  writeFileSync(gherkinCsvPath, buildGherkinCsv(enrichedScenarios), 'utf8');
  writeFileSync(gherkinFeaturePath, enrichedScenarios.map((scenario) => scenario.gherkin).join('\n\n'), 'utf8');
  writeFileSync(htmlPath, renderHtml(summary, history, enrichedScenarios), 'utf8');
  writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

export function createRunSummary(options: {
  scenarios: ScenarioResult[];
  durationMs: number;
  generatedAt?: string;
}): RunSummary {
  return summarizeRun({ stats: { duration: options.durationMs } }, options.scenarios, options.generatedAt);
}

function readJsonReport(): PlaywrightJsonReport {
  if (!existsSync(resultsPath)) {
    return { suites: [], stats: { duration: 0 } };
  }

  return JSON.parse(readFileSync(resultsPath, 'utf8')) as PlaywrightJsonReport;
}

export function flattenScenarios(report: PlaywrightJsonReport): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];

  function visitSuite(suite: PlaywrightSuite, parentTitle = ''): void {
    const suiteTitle = [parentTitle, suite.title].filter(Boolean).join(' > ');

    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const finalResult = results.at(-1);
        const status = finalResult?.status ?? 'skipped';
        const durationMs = results.reduce((total, result) => total + (result.duration ?? 0), 0);
        const title = [suiteTitle, spec.title].filter(Boolean).join(' > ');

        scenarios.push({
          title: cleanTitle(title),
          feature: featureFromFile(spec.file ?? suite.file ?? '', title),
          status,
          durationMs,
          attempts: Math.max(results.length, 1),
          tags: spec.tags ?? extractTags(spec.title),
          browser: test.projectName ?? 'chromium',
          file: normalizeFilePath(spec.file ?? suite.file ?? ''),
          error: finalResult?.error?.message
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

  return scenarios;
}

function appendHistory(summary: RunSummary): RunSummary[] {
  const previous = existsSync(historyPath) ? (JSON.parse(readFileSync(historyPath, 'utf8')) as RunSummary[]) : [];
  const validPrevious = previous.filter((run) => run.total > 0);
  const nextHistory = summary.total > 0 && validPrevious.at(-1)?.id !== summary.id ? [...validPrevious, summary] : validPrevious;
  return nextHistory.slice(-30);
}

function readLatestSavedRun(): RunSummary | undefined {
  if (!existsSync(historyPath)) return undefined;

  const history = JSON.parse(readFileSync(historyPath, 'utf8')) as RunSummary[];
  const latestRun = history.filter((run) => run.total > 0).at(-1);
  if (!latestRun) return undefined;

  return {
    ...latestRun,
    scenarios: latestRun.scenarios.map((scenario) => ({
      ...scenario,
      browser: scenario.browser ?? 'chromium',
      feature: featureFromFile(scenario.file, scenario.title)
    }))
  };
}


type ModuleSummary = {
  feature: string;
  files: string[];
  total: number;
  passed: number;
  flaky: number;
  failed: number;
  skipped: number;
  durationMs: number;
  passRate: number;
};

function renderHtml(summary: RunSummary, history: RunSummary[], scenarios: EnrichedScenario[]): string {
  const passed = summary.passed;
  const failed = summary.failed;
  const skipped = summary.skipped;
  const flaky = scenarios.filter((scenario) => scenario.statusGroup === 'flaky').length;
  const total = summary.total;
  const executed = passed + flaky + failed + skipped;
  const effectivePassed = passed + flaky;
  const passRate = percentage(effectivePassed, Math.max(executed, 1));
  const latestRunLabel = new Date(summary.generatedAt).toLocaleString();
  const summaryText = buildSummaryText(summary, flaky);
  const allGherkin = scenarios.map((scenario) => scenario.gherkin).join('\n\n');
  const modules = summarizeModules(scenarios);
  const browsers = uniqueBrowsers(scenarios);
  const slowest = [...scenarios].filter((scenario) => scenario.durationMs > 0).sort((a, b) => b.durationMs - a.durationMs)[0];
  const trend = summarizeTrend(history);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Automation Exercise Executive Test Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f5f7;
      --panel: #ffffff;
      --panel-strong: #111827;
      --text: #18202f;
      --muted: #667085;
      --line: #d7dde8;
      --passed: #17824a;
      --flaky: #2563eb;
      --failed: #c43d32;
      --skipped: #9b6a00;
      --not-run: #667085;
      --accent: #f27a1a;
      --accent-dark: #b95309;
      --blue: #2563eb;
      --shadow: 0 14px 30px rgba(24, 32, 47, .08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 Arial, Helvetica, sans-serif; }
    header { background: #171b26; color: #fff; padding: 30px 32px; border-bottom: 5px solid var(--accent); }
    .hero { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; }
    h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 46px); line-height: 1.05; }
    h2 { margin: 0 0 14px; font-size: 18px; line-height: 1.25; }
    h3 { margin: 0 0 8px; font-size: 15px; line-height: 1.3; }
    .subtle { color: var(--muted); }
    header .subtle { color: #cbd5e1; }
    .hero-actions, .actions, .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .hero-actions { justify-content: flex-end; }
    button, .file-link {
      border: 1px solid #cfd6e2;
      border-radius: 7px;
      padding: 9px 12px;
      background: #fff;
      color: var(--text);
      cursor: pointer;
      font-weight: 700;
      text-decoration: none;
      line-height: 1.15;
    }
    button:hover, .file-link:hover { border-color: var(--accent); color: var(--accent-dark); }
    .primary { border-color: var(--accent); background: var(--accent); color: #fff; }
    .primary:hover { color: #fff; border-color: #ff9a43; }
    main { max-width: 1240px; margin: 0 auto; padding: 22px 32px 44px; display: grid; gap: 18px; }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; }
    .kpi, .panel, .case-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
    .kpi { padding: 15px; min-height: 105px; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .kpi strong { display: block; margin-top: 7px; font-size: 30px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kpi strong.kpi-text { font-size: 17px; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; }
    .panel { padding: 18px; }
    .dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; }
    .module-breakdown { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; align-items: center; }
    .module-pie { width: 260px; max-width: 100%; aspect-ratio: 1; display: block; margin: 0 auto; }
    .module-legend { display: grid; gap: 8px; }
    .module-legend-row { display: grid; grid-template-columns: 12px minmax(150px, 1.4fr) repeat(7, minmax(0, .65fr)) 52px; column-gap: 12px; align-items: center; }
    .module-dot { width: 12px; height: 12px; border-radius: 999px; }
    .module-name { font-weight: 700; }
    .module-result { color: var(--muted); text-align: center; white-space: nowrap; }
    .module-separator { color: #a6afbd; text-align: center; }
    .module-rate { justify-self: end; }
    .bar { height: 10px; overflow: hidden; border-radius: 999px; background: #e5eaf1; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--passed); }
    .status-chart { display: grid; gap: 10px; margin-top: 6px; }
    .status-row, .duration-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 78px; gap: 10px; align-items: center; }
    .duration-row { grid-template-columns: minmax(70px, 160px) minmax(0, 1fr) 88px; }
    .duration-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .duration-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filters { position: sticky; top: 0; z-index: 2; padding: 12px; background: rgba(243, 245, 247, .94); border: 1px solid var(--line); border-radius: 8px; backdrop-filter: blur(10px); }
    input, select { min-height: 38px; border: 1px solid #cfd6e2; border-radius: 7px; padding: 8px 10px; background: #fff; color: var(--text); font: inherit; }
    input { flex: 1 1 280px; }
    .case-list { display: grid; gap: 14px; }
    .case-card { border-left: 6px solid var(--not-run); padding: 16px; }
    .status-passed { border-left-color: var(--passed); }
    .status-flaky { border-left-color: var(--flaky); }
    .status-failed { border-left-color: var(--failed); }
    .status-skipped { border-left-color: var(--skipped); }
    .case-card[hidden] { display: none; }
    .case-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .case-meta { color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .status { border: 1px solid var(--line); border-radius: 999px; padding: 5px 10px; white-space: nowrap; background: #fff; font-weight: 700; }
    .status[data-status="Passed"] { color: var(--passed); }
    .status[data-status="Flaky"] { color: var(--flaky); }
    .status[data-status="Failed"] { color: var(--failed); }
    .status[data-status="Skipped"] { color: var(--skipped); }
    pre { overflow: auto; margin: 12px 0; padding: 13px; background: var(--panel-strong); color: #f8fafc; border-radius: 7px; white-space: pre-wrap; font: 13px/1.5 Consolas, Monaco, monospace; }
    .hidden-copy { position: fixed; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
    .empty { display: none; padding: 20px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; background: #fff; }
    @media (max-width: 920px) {
      .hero, .dashboard-grid, .module-breakdown { grid-template-columns: 1fr; }
      .hero-actions { justify-content: flex-start; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      header, main { padding-left: 18px; padding-right: 18px; }
    }
    @media (max-width: 560px) {
      .kpis { grid-template-columns: 1fr; }
      .case-header, .status-row, .duration-row, .module-legend-row { grid-template-columns: 1fr; display: grid; }
      .module-result { white-space: normal; }
      .module-separator { display: none; }
      .module-rate { justify-self: start; }
      button, .file-link, select, input { width: 100%; }
    }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { background: white; }
      header, main { padding-left: 12px; padding-right: 12px; }
      .panel, .case-card, .kpi { box-shadow: none; break-inside: avoid; }
      .filters, .actions, .hero-actions { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="hero">
      <div>
        <h1>Automation Exercise Executive Test Dashboard</h1>
        <div class="subtle">Command: npm test | Updated: ${escapeHtml(latestRunLabel)} | Mode: Headless Cross-Browser</div>
      </div>
      <div class="hero-actions">
        <button type="button" class="primary" data-copy-target="copy-executive">Copy Executive Summary</button>
        <button type="button" data-copy-target="copy-all-gherkin">Copy All Gherkin</button>
        <a class="file-link" href="gherkin-cases.csv" download>CSV</a>
        <button type="button" data-print>Save PDF</button>
      </div>
    </div>
  </header>
  <main>
    <section class="kpis" aria-label="Run summary">
      <div class="kpi"><span>Effective Pass Rate</span><strong>${passRate}%</strong><small>${effectivePassed}/${executed || 0} passed including flaky</small></div>
      <div class="kpi"><span>Stable Passed</span><strong>${passed}</strong><small>${flaky} flaky, ${failed} failed</small></div>
      <div class="kpi"><span>Total Runtime</span><strong>${formatDuration(summary.durationMs)}</strong><small>Latest headless run</small></div>
      <div class="kpi"><span>Coverage</span><strong>${total}</strong><small>${skipped} skipped</small></div>
      <div class="kpi"><span>Slowest</span><strong class="kpi-text">${slowest ? escapeHtml(shortCaseLabel(slowest)) : 'n/a'}</strong><small>${slowest ? formatDuration(slowest.durationMs) : 'No duration yet'}</small></div>
    </section>
    <section class="panel" aria-label="Run commands">
      <h2>Run Commands</h2>
      <div class="subtle">Copy a command, run it in PowerShell from this project folder, then refresh this report after the test run finishes.</div>
      <div class="actions" style="margin-top:12px">${renderSuiteCommands(modules)}</div>
    </section>
    <section class="dashboard-grid" aria-label="Charts">
      <div class="panel"><h2>Status Distribution</h2>${renderStatusRows({ passed, flaky, failed, skipped, total: Math.max(total, 1) })}</div>
      <div class="panel"><h2>Module Health</h2><div class="module-breakdown">${renderModulePieSvg(modules)}<div class="module-legend">${renderModuleLegend(modules)}</div></div></div>
      <div class="panel"><h2>Confidence Trend</h2>${renderTrendSummary(trend, summary, flaky)}</div>
    </section>
    <section class="panel" aria-label="Duration breakdown">
      <h2>Slowest Tests</h2>
      <div class="status-chart">${renderDurationRows(scenarios) || '<div class="subtle">No duration data yet.</div>'}</div>
    </section>
    <section class="filters" aria-label="Filters">
      <input id="search" type="search" placeholder="Search cases, suites, features, tags, expected result">
      <select id="status-filter"><option value="">All statuses</option><option>Passed</option><option>Flaky</option><option>Failed</option><option>Skipped</option></select>
      <select id="module-filter"><option value="">All modules</option>${modules.map((module) => `<option>${escapeHtml(module.feature)}</option>`).join('\n')}</select>
      <select id="browser-filter"><option value="">All browsers</option>${browsers.map((browser) => `<option value="${escapeHtml(browser)}">${escapeHtml(browserLabel(browser))}</option>`).join('\n')}</select>
      <button type="button" id="reset-results">Reset</button>
    </section>
    <section class="case-list" aria-label="Business Gherkin test cases">
      ${renderDashboardScenarioCards(scenarios)}
      <div id="empty" class="empty">No test cases match the current filters.</div>
    </section>
  </main>
  <pre id="copy-executive" class="hidden-copy">${escapeHtml(summaryText)}</pre>
  <pre id="copy-all-gherkin" class="hidden-copy">${escapeHtml(allGherkin)}</pre>
  ${renderSuiteCommandCopies(modules)}
  <script>
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');
    const moduleFilter = document.getElementById('module-filter');
    const browserFilter = document.getElementById('browser-filter');
    const resetResults = document.getElementById('reset-results');
    const cards = [...document.querySelectorAll('.case-card')];
    const empty = document.getElementById('empty');

    let revealed = false;

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      const module = moduleFilter.value;
      const browser = browserFilter.value;
      let visible = 0;

      for (const card of cards) {
        const show = revealed && (!query || card.dataset.search.includes(query)) && (!status || card.dataset.status === status) && (!module || card.dataset.module === module) && (!browser || card.dataset.browser === browser);
        card.hidden = !show;
        if (show) visible += 1;
      }

      empty.style.display = revealed && visible === 0 ? 'block' : 'none';
    }

    function revealAndFilter() {
      revealed = true;
      applyFilters();
    }

    search.addEventListener('input', revealAndFilter);
    statusFilter.addEventListener('change', revealAndFilter);
    moduleFilter.addEventListener('change', revealAndFilter);
    browserFilter.addEventListener('change', revealAndFilter);
    resetResults.addEventListener('click', () => {
      search.value = '';
      statusFilter.value = '';
      moduleFilter.value = '';
      browserFilter.value = '';
      revealed = false;
      applyFilters();
    });
    applyFilters();

    document.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-copy-target]');
      if (!button) return;
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target) return;
      await navigator.clipboard.writeText(target.innerText);
      const oldText = button.innerText;
      button.innerText = 'Copied';
      setTimeout(() => { button.innerText = oldText; }, 1200);
    });

    document.querySelectorAll('[data-print]').forEach(button => {
      button.addEventListener('click', () => {
        window.print();
      });
    });
  </script>
</body>
</html>`;
}

function summarizeModules(scenarios: EnrichedScenario[]): ModuleSummary[] {
  return Object.entries(groupByFeature(scenarios)).map(([feature, featureScenarios]) => {
    const passed = featureScenarios.filter((scenario) => scenario.statusGroup === 'passed').length;
    const flaky = featureScenarios.filter((scenario) => scenario.statusGroup === 'flaky').length;
    const failed = featureScenarios.filter((scenario) => scenario.statusGroup === 'failed').length;
    const skipped = featureScenarios.filter((scenario) => scenario.statusGroup === 'skipped').length;
    const executed = passed + flaky + failed + skipped;

    return {
      feature,
      files: uniqueScenarioFiles(featureScenarios),
      total: featureScenarios.length,
      passed,
      flaky,
      failed,
      skipped,
      durationMs: featureScenarios.reduce((totalDuration, scenario) => totalDuration + scenario.durationMs, 0),
      passRate: percentage(passed + flaky, Math.max(executed, 1))
    };
  });
}

function renderSuiteCommands(modules: ModuleSummary[]): string {
  const commands = [['All Cases', 'npm test'], ...modules.map((module) => [module.feature, runCommandForModule(module)])];
  return commands
    .map(([label], index) => `<button type="button" data-copy-target="copy-command-${index}">${escapeHtml(label)}</button>`)
    .join('\n');
}

function renderSuiteCommandCopies(modules: ModuleSummary[]): string {
  const commands = [['All Cases', 'npm test'], ...modules.map((module) => [module.feature, runCommandForModule(module)])];
  return commands
    .map(([, command], index) => `<pre id="copy-command-${index}" class="hidden-copy">${escapeHtml(command)}</pre>`)
    .join('\n');
}

function uniqueScenarioFiles(scenarios: EnrichedScenario[]): string[] {
  return [...new Set(scenarios.map((scenario) => scenario.file).filter(Boolean) as string[])];
}

function uniqueBrowsers(scenarios: EnrichedScenario[]): string[] {
  return [...new Set(scenarios.map((scenario) => scenario.browser))].sort();
}

function runCommandForModule(module: ModuleSummary): string {
  if (!module.files.length) return 'npm test';

  return `npx playwright test ${module.files.map(commandPath).map(shellQuote).join(' ')}`;
}

function renderStatusRows(status: { passed: number; flaky: number; failed: number; skipped: number; total: number }): string {
  const statuses = [
    ['Passed', status.passed, 'var(--passed)'],
    ['Flaky', status.flaky, 'var(--blue)'],
    ['Failed', status.failed, 'var(--failed)'],
    ['Skipped', status.skipped, 'var(--skipped)']
  ] as const;

  return `<div class="status-chart">${statuses
    .map(
      ([label, value, color]) => `
    <div class="status-row">
      <strong>${label}</strong>
      <div class="bar"><span style="width:${percentage(value, status.total)}%; background:${color}"></span></div>
      <span>${value} tests</span>
    </div>`
    )
    .join('\n')}</div>`;
}

function renderModulePieSvg(modules: ModuleSummary[]): string {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const total = modules.reduce((count, module) => count + module.total, 0);
  let offset = 0;

  if (!modules.length || total === 0) {
    return `<svg class="module-pie" viewBox="0 0 100 100" role="img" aria-label="Module health pie chart">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e5eaf1" stroke-width="18"></circle>
      <circle cx="50" cy="50" r="23" fill="#fff" stroke="#d7dde8" stroke-width=".6"></circle>
    </svg>`;
  }

  const slices = modules
    .map((module, index) => {
      const length = (module.total / total) * circumference;
      const slice = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${moduleColor(index)}" stroke-width="18" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 50 50)"></circle>`;
      offset += length;
      return slice;
    })
    .join('\n      ');

  return `<svg class="module-pie" viewBox="0 0 100 100" role="img" aria-label="Module health pie chart">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e5eaf1" stroke-width="18"></circle>
      ${slices}
      <circle cx="50" cy="50" r="23" fill="#fff" stroke="#d7dde8" stroke-width=".6"></circle>
    </svg>`;
}

function renderModuleLegend(modules: ModuleSummary[]): string {
  if (!modules.length) {
    return '<div class="subtle">Run the suite to populate module health.</div>';
  }

  return modules
    .map(
      (module, index) => `<div class="module-legend-row">
        <span class="module-dot" style="background:${moduleColor(index)}"></span>
        <span class="module-name">${escapeHtml(module.feature)}</span>
        <span class="module-result">${module.passed} passed</span>
        <span class="module-separator">|</span>
        <span class="module-result">${module.flaky} flaky</span>
        <span class="module-separator">|</span>
        <span class="module-result">${module.failed} failed</span>
        <span class="module-separator">|</span>
        <span class="module-result">${module.skipped} skipped</span>
        <strong class="module-rate">${module.passRate}%</strong>
      </div>`
    )
    .join('\n');
}

function renderDurationRows(scenarios: EnrichedScenario[]): string {
  const slowestScenarios = [...scenarios]
    .filter((scenario) => scenario.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);
  const maxDuration = Math.max(...slowestScenarios.map((scenario) => scenario.durationMs), 1);

  return slowestScenarios
    .map(
      (scenario) => `
    <div class="duration-row">
      <strong class="duration-name">${escapeHtml(shortCaseLabel(scenario))} (${escapeHtml(browserLabel(scenario.browser))})</strong>
      <div class="bar"><span style="width:${percentage(scenario.durationMs, maxDuration)}%"></span></div>
      <span class="duration-label">${formatDuration(scenario.durationMs)}</span>
    </div>`
    )
    .join('\n');
}

function renderDashboardScenarioCards(scenarios: EnrichedScenario[]): string {
  return scenarios
    .map((scenario, index) => {
      const status = statusDisplay(scenario.statusGroup);
      const gherkinId = `gherkin-${index}`;
      const csvId = `csv-${index}`;
      const commandId = `command-${index}`;
      const searchText = [scenario.title, scenario.feature, scenario.browser, browserLabel(scenario.browser), scenario.tags.join(' '), scenario.gherkin, status].join(' ').toLowerCase();

      return `
    <article class="case-card status-${scenario.statusGroup}" data-status="${status}" data-module="${escapeHtml(scenario.feature)}" data-browser="${escapeHtml(scenario.browser)}" data-search="${escapeHtml(searchText)}">
      <div class="case-header">
        <div>
          <div class="case-meta">${escapeHtml(shortCaseLabel(scenario))} | ${escapeHtml(scenario.feature)} | ${escapeHtml(browserLabel(scenario.browser))} | ${formatDuration(scenario.durationMs)}</div>
          <h2>${escapeHtml(scenario.title)}</h2>
          <div class="subtle">${escapeHtml(scenario.tags.join(' ') || 'untagged')} | ${scenario.attempts} attempt${scenario.attempts === 1 ? '' : 's'}</div>
        </div>
        <span class="status" data-status="${status}">${status}</span>
      </div>
      <pre id="${gherkinId}">${escapeHtml(scenario.gherkin)}</pre>
      ${scenario.error ? `<pre>${escapeHtml(scenario.error)}</pre>` : ''}
      <pre id="${csvId}" class="hidden-copy">${escapeHtml(scenario.csvRow)}</pre>
      <pre id="${commandId}" class="hidden-copy">${escapeHtml(scenario.command)}</pre>
      <div class="actions">
        <button type="button" data-copy-target="${gherkinId}">Copy Gherkin</button>
        <button type="button" data-copy-target="${csvId}">Copy CSV Row</button>
        <button type="button" data-copy-target="${commandId}">Copy Run Command</button>
      </div>
    </article>`;
    })
    .join('\n');
}

function summarizeTrend(history: RunSummary[]): { current: number; best: number; previous?: number; runs: number; cleanStreak: number } {
  const scores = history.map((run) => run.confidenceScore);
  const current = scores.at(-1) ?? 0;

  let cleanStreak = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].total > 0 && history[index].failed === 0) {
      cleanStreak += 1;
    } else {
      break;
    }
  }

  return {
    current,
    best: scores.length ? Math.max(...scores) : current,
    previous: scores.length > 1 ? scores.at(-2) : undefined,
    runs: history.length,
    cleanStreak
  };
}

function renderTrendSummary(trend: ReturnType<typeof summarizeTrend>, summary: RunSummary, flaky: number): string {
  const change = describeTrendChange(trend);
  const recommendation = buildExecutiveRecommendation(summary, flaky);
  const reliability = buildReliabilityNote(trend, summary);

  return `<div class="status-chart">
    <div class="status-row"><strong>This Run</strong><div class="bar"><span style="width:${trend.current}%"></span></div><span>${trend.current} / 100</span></div>
    <div class="status-row"><strong>Best Ever</strong><div class="bar"><span style="width:${trend.best}%"></span></div><span>${trend.best} / 100</span></div>
    <div class="subtle"><strong>Confidence: ${confidenceLabel(trend.current)}</strong> &mdash; ${escapeHtml(change)}.</div>
    <div class="subtle"><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</div>
    <div class="subtle"><strong>Reliability:</strong> ${escapeHtml(reliability)}</div>
  </div>`;
}

function confidenceLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'At Risk';
  return 'Critical';
}

function describeTrendChange(trend: ReturnType<typeof summarizeTrend>): string {
  if (trend.previous === undefined) return 'first recorded run';

  const delta = trend.current - trend.previous;
  if (delta === 0) return 'unchanged since the previous run';
  return delta > 0 ? `up ${delta} since the previous run` : `down ${Math.abs(delta)} since the previous run`;
}

// Translate the raw result into the one decision a stakeholder cares about: can we ship?
function buildExecutiveRecommendation(summary: RunSummary, flaky: number): string {
  if (summary.failed > 0) {
    return `Hold the release. ${summary.failed} scenario${summary.failed === 1 ? '' : 's'} failed and must be triaged before shipping.`;
  }
  if (summary.skipped > 0) {
    return `Proceed once skips are reviewed. Every executed scenario passed, but ${summary.skipped} ${summary.skipped === 1 ? 'was' : 'were'} skipped and left unverified.`;
  }
  if (flaky > 0) {
    return `Proceed with caution. Every scenario passed, but ${flaky} ${flaky === 1 ? 'was' : 'were'} flaky and should be stabilised to keep the signal trustworthy.`;
  }
  return 'Cleared to proceed. Every scenario passed with no failures, skips, or flakiness.';
}

// Use the saved history to show whether recent changes are introducing regressions over time.
function buildReliabilityNote(trend: ReturnType<typeof summarizeTrend>, summary: RunSummary): string {
  if (summary.failed > 0) {
    return 'The latest run has failures, breaking the clean streak — recent changes introduced at least one regression.';
  }
  if (trend.cleanStreak >= 2) {
    return `${trend.cleanStreak} consecutive clean runs with zero failed scenarios — no regressions across the saved history.`;
  }
  return 'Latest run is clean — the start of a fresh, regression-free reliability streak.';
}

function moduleColor(index: number): string {
  return ['#f27a1a', '#17824a', '#2563eb', '#c43d32', '#9b6a00', '#7c3aed', '#0f766e', '#db2777', '#475569'][index % 9];
}

function statusDisplay(status: EnrichedScenario['statusGroup']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function shortCaseLabel(scenario: EnrichedScenario): string {
  const taggedId = scenario.tags.find(isScenarioIdTag)?.replace('@', '');
  if (taggedId) return taggedId;

  const caseName = scenario.title.split(' > ').at(-1) ?? 'case';
  const words = caseName.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function browserLabel(browser: string): string {
  if (browser === 'chromium') return 'Chromium';
  if (browser === 'firefox') return 'Firefox';
  if (browser === 'webkit') return 'WebKit';
  return browser;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function groupByFeature<T extends { feature: string }>(scenarios: T[]): Record<string, T[]> {
  return scenarios.reduce<Record<string, T[]>>((groups, scenario) => {
    groups[scenario.feature] = groups[scenario.feature] ?? [];
    groups[scenario.feature].push(scenario);
    return groups;
  }, {});
}

function buildSummaryText(summary: RunSummary, flaky: number): string {
  return [
    'Automation Exercise Executive Quality Report',
    `Generated: ${new Date(summary.generatedAt).toLocaleString()}`,
    `Confidence score: ${summary.confidenceScore}`,
    `Confidence formula: pass rate minus ${FAILED_SCENARIO_PENALTY} per failed scenario and ${SKIPPED_SCENARIO_PENALTY} per skipped scenario`,
    `Total scenarios: ${summary.total}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Skipped: ${summary.skipped}`,
    `Flaky: ${flaky}`,
    `Duration: ${formatDuration(summary.durationMs)}`,
    `Status: ${statusLabel(summary)}`
  ].join('\n');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function statusLabel(summary: RunSummary): string {
  if (summary.failed > 0) return 'Action Required';
  if (summary.skipped > 0) return 'Review Skips';
  return 'Ready For Review';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
