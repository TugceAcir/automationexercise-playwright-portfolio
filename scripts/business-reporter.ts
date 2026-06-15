import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type PlaywrightResultStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

type PlaywrightJsonReport = {
  suites?: PlaywrightSuite[];
  stats?: {
    duration?: number;
  };
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
  status: PlaywrightResultStatus;
  duration?: number;
  error?: {
    message?: string;
  };
};

type ScenarioResult = {
  title: string;
  feature: string;
  status: PlaywrightResultStatus;
  durationMs: number;
  attempts: number;
  tags: string[];
  file?: string;
  error?: string;
};

type RunSummary = {
  id: string;
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  confidenceScore: number;
  scenarios: ScenarioResult[];
};

type EnrichedScenario = ScenarioResult & {
  statusGroup: 'passed' | 'flaky' | 'failed' | 'skipped';
  command: string;
  gherkin: string;
  csvRow: string;
};

const resultsPath = path.resolve('test-results/results.json');
const reportDir = path.resolve('business-report');
const historyPath = path.join(reportDir, 'history.json');
const htmlPath = path.join(reportDir, 'index.html');
const gherkinCsvPath = path.join(reportDir, 'gherkin-cases.csv');
const gherkinFeaturePath = path.join(reportDir, 'gherkin-cases.feature');

export async function buildBusinessReport(): Promise<void> {
  mkdirSync(reportDir, { recursive: true });

  const report = readJsonReport();
  const scenarios = flattenScenarios(report);
  const latestSavedRun = readLatestSavedRun();
  if (!scenarios.length && latestSavedRun) {
    writeBusinessReport(latestSavedRun);
    return;
  }

  const summary = summarizeRun(report, scenarios);
  writeBusinessReport(summary);
}

export function writeBusinessReport(summary: RunSummary): void {
  mkdirSync(reportDir, { recursive: true });

  const history = appendHistory(summary);
  const enrichedScenarios = enrichScenarios(summary.scenarios);

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

function flattenScenarios(report: PlaywrightJsonReport): ScenarioResult[] {
  const scenarios: ScenarioResult[] = [];

  function visitSuite(suite: PlaywrightSuite, parentTitle = ''): void {
    const suiteTitle = [parentTitle, suite.title].filter(Boolean).join(' > ');

    for (const spec of suite.specs ?? []) {
      const test = spec.tests?.[0];
      const results = test?.results ?? [];
      const finalResult = results.at(-1);
      const status = finalResult?.status ?? 'skipped';
      const durationMs = results.reduce((total, result) => total + (result.duration ?? 0), 0);
      const title = [suiteTitle, spec.title].filter(Boolean).join(' > ');

      scenarios.push({
        title: cleanTitle(title),
        feature: featureFromFile(`${spec.file ?? suite.file ?? ''} ${title}`),
        status,
        durationMs,
        attempts: Math.max(results.length, 1),
        tags: spec.tags ?? extractTags(spec.title),
        file: normalizeFilePath(spec.file ?? suite.file ?? ''),
        error: finalResult?.error?.message
      });
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

function summarizeRun(report: PlaywrightJsonReport, scenarios: ScenarioResult[], generatedAt = new Date().toISOString()): RunSummary {
  const passed = scenarios.filter((scenario) => scenario.status === 'passed').length;
  const skipped = scenarios.filter((scenario) => scenario.status === 'skipped').length;
  const failed = scenarios.length - passed - skipped;
  const total = scenarios.length;
  const passRate = total === 0 ? 0 : passed / total;
  const confidenceScore = Math.max(0, Math.round(passRate * 100 - failed * 12 - skipped * 4));

  return {
    id: generatedAt.replace(/[:.]/g, '-'),
    generatedAt,
    total,
    passed,
    failed,
    skipped,
    durationMs: report.stats?.duration ?? scenarios.reduce((totalDuration, scenario) => totalDuration + scenario.durationMs, 0),
    confidenceScore,
    scenarios
  };
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
      feature: featureFromFile(`${scenario.file ?? ''} ${scenario.title}`)
    }))
  };
}

function enrichScenarios(scenarios: ScenarioResult[]): EnrichedScenario[] {
  return scenarios.map((scenario) => {
    const enriched = {
      ...scenario,
      statusGroup: scenarioStatusGroup(scenario),
      command: runCommandForScenario(scenario),
      gherkin: gherkinForScenario(scenario)
    };

    return {
      ...enriched,
      csvRow: scenarioCsvRow(enriched)
    };
  });
}

type ModuleSummary = {
  feature: string;
  total: number;
  passed: number;
  flaky: number;
  failed: number;
  skipped: number;
  durationMs: number;
  passRate: number;
};

function renderHtml(summary: RunSummary, _history: RunSummary[], scenarios: EnrichedScenario[]): string {
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
  const slowest = [...scenarios].filter((scenario) => scenario.durationMs > 0).sort((a, b) => b.durationMs - a.durationMs)[0];

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
    .kpi strong { display: block; margin-top: 7px; font-size: 30px; line-height: 1.1; }
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
        <div class="subtle">Command: npm test | Updated: ${escapeHtml(latestRunLabel)} | Mode: Headless Chromium</div>
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
      <div class="kpi"><span>Slowest</span><strong>${slowest ? escapeHtml(shortCaseLabel(slowest)) : 'n/a'}</strong><small>${slowest ? formatDuration(slowest.durationMs) : 'No duration yet'}</small></div>
    </section>
    <section class="panel" aria-label="Run commands">
      <h2>Run Commands</h2>
      <div class="subtle">Copy a command, run it in PowerShell from this project folder, then refresh this report after the test run finishes.</div>
      <div class="actions" style="margin-top:12px">${renderSuiteCommands(modules.map((module) => module.feature))}</div>
    </section>
    <section class="dashboard-grid" aria-label="Charts">
      <div class="panel"><h2>Status Distribution</h2>${renderStatusRows({ passed, flaky, failed, skipped, total: Math.max(total, 1) })}</div>
      <div class="panel"><h2>Module Health</h2><div class="module-breakdown">${renderModulePieSvg(modules)}<div class="module-legend">${renderModuleLegend(modules)}</div></div></div>
    </section>
    <section class="panel" aria-label="Duration breakdown">
      <h2>Slowest Tests</h2>
      <div class="status-chart">${renderDurationRows(scenarios) || '<div class="subtle">No duration data yet.</div>'}</div>
    </section>
    <section class="filters" aria-label="Filters">
      <input id="search" type="search" placeholder="Search cases, suites, features, tags, expected result">
      <select id="status-filter"><option value="">All statuses</option><option>Passed</option><option>Flaky</option><option>Failed</option><option>Skipped</option></select>
      <select id="module-filter"><option value="">All modules</option>${modules.map((module) => `<option>${escapeHtml(module.feature)}</option>`).join('\n')}</select>
      <button type="button" id="reset-results">Reset</button>
    </section>
    <section class="case-list" aria-label="Business Gherkin test cases">
      ${renderDashboardScenarioCards(scenarios)}
      <div id="empty" class="empty">No test cases match the current filters.</div>
    </section>
  </main>
  <pre id="copy-executive" class="hidden-copy">${escapeHtml(summaryText)}</pre>
  <pre id="copy-all-gherkin" class="hidden-copy">${escapeHtml(allGherkin)}</pre>
  ${renderSuiteCommandCopies(modules.map((module) => module.feature))}
  <script>
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');
    const moduleFilter = document.getElementById('module-filter');
    const resetResults = document.getElementById('reset-results');
    const cards = [...document.querySelectorAll('.case-card')];
    const empty = document.getElementById('empty');

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      const status = statusFilter.value;
      const module = moduleFilter.value;
      const filtersActive = Boolean(query || status || module);
      let visible = 0;

      for (const card of cards) {
        const show = filtersActive && (!query || card.dataset.search.includes(query)) && (!status || card.dataset.status === status) && (!module || card.dataset.module === module);
        card.hidden = !show;
        if (show) visible += 1;
      }

      empty.textContent = filtersActive ? 'No test cases match the current filters.' : 'Search or filter to view matching test cases.';
      empty.style.display = visible ? 'none' : 'block';
    }

    search.addEventListener('input', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    moduleFilter.addEventListener('change', applyFilters);
    resetResults.addEventListener('click', () => {
      search.value = '';
      statusFilter.value = '';
      moduleFilter.value = '';
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

export function renderLegacyHtml(summary: RunSummary, history: RunSummary[], scenarios: EnrichedScenario[]): string {
  const passed = summary.passed;
  const failed = summary.failed;
  const skipped = summary.skipped;
  const flaky = scenarios.filter((scenario) => scenario.statusGroup === 'flaky').length;
  const total = Math.max(summary.total, 1);
  const passRate = percentage(passed, total);
  const failedRate = percentage(failed, total);
  const flakyRate = percentage(flaky, total);
  const skippedRate = percentage(skipped, total);
  const latestRunLabel = new Date(summary.generatedAt).toLocaleString();
  const verdict = executiveVerdict(summary, flaky);
  const summaryText = buildSummaryText(summary, flaky);
  const allGherkin = scenarios.map((scenario) => scenario.gherkin).join('\n\n');
  const trendValues = history.map((run) => run.confidenceScore).join(',');
  const featureCards = renderFeatureCards(scenarios);
  const featureHealthBars = renderFeatureHealthBars(scenarios);
  const riskRows = renderRiskRows(scenarios);
  const scenarioCards = renderScenarioCards(scenarios);
  const statusLegend = renderStatusLegend({ passed, failed, flaky, skipped });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Automation Exercise Executive Quality Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --surface: #ffffff;
      --surface-soft: #f8fafc;
      --ink: #101828;
      --muted: #667085;
      --line: #d9e2ec;
      --green: #12805c;
      --green-soft: #e8f7f1;
      --red: #b42318;
      --red-soft: #fff1f0;
      --amber: #b54708;
      --amber-soft: #fff7e6;
      --blue: #2457d6;
      --blue-soft: #eef4ff;
      --purple: #6941c6;
      --purple-soft: #f4f0ff;
      --shadow: 0 18px 50px rgba(16, 24, 40, .09);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.45; }
    button, input, a { font: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px; }
    .hero {
      min-height: 440px;
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) 360px;
      gap: 28px;
      align-items: stretch;
      color: white;
      background:
        linear-gradient(135deg, rgba(12, 18, 32, .96), rgba(31, 73, 148, .92) 55%, rgba(18, 128, 92, .92)),
        repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 18px);
      border-radius: 18px;
      padding: 34px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .eyebrow { color: #bfdbfe; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 12px 0 12px; max-width: 780px; font-size: clamp(34px, 5vw, 62px); line-height: 1.02; letter-spacing: 0; }
    .hero-copy { max-width: 760px; color: #dbeafe; font-size: 18px; margin: 0; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
    .hero-meta span { border: 1px solid rgba(255,255,255,.24); background: rgba(255,255,255,.11); border-radius: 999px; padding: 8px 11px; font-size: 13px; font-weight: 700; }
    .decision { margin-top: 28px; max-width: 760px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); border-radius: 12px; padding: 18px; }
    .decision strong { display: block; font-size: 20px; }
    .decision p { color: #dbeafe; margin: 6px 0 0; }
    .score-card { background: rgba(255,255,255,.96); color: var(--ink); border-radius: 16px; padding: 24px; display: grid; align-content: space-between; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
    .score-ring {
      width: 230px;
      aspect-ratio: 1;
      margin: 0 auto;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: conic-gradient(${scoreColor(summary.confidenceScore)} ${summary.confidenceScore * 3.6}deg, #e4e7ec 0);
      position: relative;
    }
    .score-ring::after { content: ""; position: absolute; width: 168px; aspect-ratio: 1; border-radius: 50%; background: white; box-shadow: inset 0 0 0 1px var(--line); }
    .score-value { position: relative; z-index: 1; text-align: center; }
    .score-value strong { display: block; font-size: 56px; line-height: 1; color: ${scoreColor(summary.confidenceScore)}; }
    .score-value span { color: var(--muted); font-weight: 800; text-transform: uppercase; font-size: 12px; }
    .score-note { margin: 20px 0 0; color: var(--muted); text-align: center; }
    .section { margin-top: 22px; }
    .section-head { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 12px; }
    .section h2 { margin: 0; font-size: 22px; letter-spacing: 0; }
    .section-head p { margin: 4px 0 0; color: var(--muted); }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .metric { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 8px 26px rgba(16, 24, 40, .05); }
    .metric span { display: block; color: var(--muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 5px; font-size: 32px; }
    .metric small { color: var(--muted); }
    .status-strip { display: grid; grid-template-columns: ${passRate}fr ${flakyRate}fr ${failedRate}fr ${skippedRate}fr; min-height: 16px; overflow: hidden; border-radius: 999px; background: #e4e7ec; border: 1px solid var(--line); }
    .status-strip div:nth-child(1) { background: var(--green); }
    .status-strip div:nth-child(2) { background: var(--purple); }
    .status-strip div:nth-child(3) { background: var(--red); }
    .status-strip div:nth-child(4) { background: var(--amber); }
    .dashboard-grid { display: grid; grid-template-columns: 330px 1fr 300px; gap: 16px; align-items: stretch; }
    .donut-panel, .feature-health, .spark-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 8px 26px rgba(16, 24, 40, .05); }
    .donut { width: 230px; height: 230px; display: block; margin: 0 auto; }
    .legend { display: grid; gap: 8px; margin-top: 12px; }
    .legend-item { display: grid; grid-template-columns: 12px 1fr auto; gap: 8px; align-items: center; color: var(--muted); font-size: 13px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 999px; }
    .feature-health-list { display: grid; gap: 12px; }
    .health-row { display: grid; gap: 6px; }
    .health-top { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
    .health-top strong { color: var(--ink); }
    .health-top span { color: var(--muted); }
    .health-track { height: 12px; border-radius: 999px; background: #e4e7ec; overflow: hidden; display: flex; }
    .health-pass { background: var(--green); }
    .health-flaky { background: var(--purple); }
    .health-failed { background: var(--red); }
    .spark { width: 100%; height: 120px; }
    .executive-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: 0 8px 26px rgba(16, 24, 40, .05); }
    .action-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    button, .button-link {
      border: 1px solid rgba(36, 87, 214, .18);
      border-radius: 999px;
      min-height: 36px;
      padding: 8px 13px;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
      color: var(--ink);
      text-decoration: none;
      text-align: center;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(16, 24, 40, .05);
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease, color .15s ease;
    }
    button:hover, .button-link:hover, button.active { border-color: rgba(36, 87, 214, .45); color: var(--blue); background: var(--blue-soft); box-shadow: 0 10px 24px rgba(36, 87, 214, .12); transform: translateY(-1px); }
    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .feature-card { border: 1px solid var(--line); border-radius: 12px; padding: 14px; background: var(--surface); }
    .feature-card strong { display: block; font-size: 16px; }
    .feature-card span { color: var(--muted); font-size: 13px; }
    .feature-bar { height: 8px; margin-top: 12px; border-radius: 999px; background: #e4e7ec; overflow: hidden; }
    .feature-bar div { height: 100%; background: var(--green); }
    .risk-list { display: grid; gap: 10px; }
    .risk-item { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: var(--surface-soft); }
    .risk-item strong { display: block; }
    .risk-item span { color: var(--muted); font-size: 13px; }
    .risk-badge { border-radius: 999px; padding: 6px 9px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .risk-badge.low { color: var(--green); background: var(--green-soft); }
    .risk-badge.high { color: var(--red); background: var(--red-soft); }
    .revealed-command { display: none; margin-top: 12px; border: 1px solid rgba(36, 87, 214, .2); background: var(--blue-soft); border-radius: 12px; padding: 12px; }
    .revealed-command.visible { display: block; }
    .revealed-command span { display: block; color: var(--muted); font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; }
    .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-bottom: 12px; }
    input { width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .case-count { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
    .case-list { display: grid; gap: 12px; }
    .case-card { background: var(--surface); border: 1px solid var(--line); border-left: 5px solid var(--blue); border-radius: 14px; padding: 16px; box-shadow: 0 6px 18px rgba(16, 24, 40, .04); }
    .case-card[data-status="passed"] { border-left-color: var(--green); }
    .case-card[data-status="failed"] { border-left-color: var(--red); }
    .case-card[data-status="flaky"] { border-left-color: var(--purple); }
    .case-card[data-status="skipped"] { border-left-color: var(--amber); }
    .case-card.hidden { display: none; }
    .case-main { display: grid; grid-template-columns: 1fr auto; gap: 12px; }
    .case-title { font-weight: 900; }
    .case-meta { color: var(--muted); font-size: 13px; margin-top: 4px; }
    .status { align-self: start; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .passed { color: var(--green); background: var(--green-soft); }
    .failed { color: var(--red); background: var(--red-soft); }
    .flaky { color: var(--purple); background: var(--purple-soft); }
    .skipped { color: var(--amber); background: var(--amber-soft); }
    details { margin-top: 12px; }
    summary { cursor: pointer; color: var(--blue); font-weight: 900; }
    pre { white-space: pre-wrap; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; padding: 12px; }
    .case-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .command-row { margin-top: 10px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    code { display: block; white-space: nowrap; overflow: auto; border-radius: 10px; background: #f2f4f7; padding: 10px; }
    @media (max-width: 980px) {
      .shell { padding: 18px; }
      .hero, .executive-grid, .toolbar, .dashboard-grid { grid-template-columns: 1fr; }
      .metrics, .features { grid-template-columns: repeat(2, 1fr); }
      .score-card { max-width: 380px; }
    }
    @media (max-width: 620px) {
      .metrics, .features, .case-main, .command-row { grid-template-columns: 1fr; }
      .hero { padding: 24px; }
    }
    @media print {
      body { background: white; }
      .shell { max-width: none; padding: 0; }
      .hero, .section, .panel, .feature-card, .case-card { box-shadow: none; break-inside: avoid; }
      .hero { min-height: auto; color: var(--ink); background: white; border: 1px solid var(--line); }
      .hero-copy, .hero-meta span, .decision p { color: var(--muted); }
      .score-card { border: 1px solid var(--line); box-shadow: none; }
      .action-grid, .toolbar, .case-actions, .command-row { display: none; }
      details { open: true; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        <div class="eyebrow">Executive automation report</div>
        <h1>Release confidence, translated into business evidence.</h1>
        <p class="hero-copy">A Playwright TypeScript suite for Automation Exercise, summarized for leaders, recruiters, and QA decision makers with traceable Gherkin evidence and reproducible run commands.</p>
        <div class="hero-meta">
          <span>${escapeHtml(statusLabel(summary))}</span>
          <span>${escapeHtml(latestRunLabel)}</span>
          <span>Headless Chromium</span>
          <span>${summary.total} scenarios</span>
        </div>
        <div class="decision">
          <strong>${escapeHtml(verdict.title)}</strong>
          <p>${escapeHtml(verdict.body)}</p>
        </div>
      </div>
      <aside class="score-card">
        <div class="score-ring">
          <div class="score-value">
            <strong>${summary.confidenceScore}</strong>
            <span>confidence</span>
          </div>
        </div>
        <p class="score-note">${passRate}% pass rate across ${summary.total} business-facing checks.</p>
      </aside>
    </section>

    <section class="section">
      <div class="metrics">
        <article class="metric"><span>Passed</span><strong>${passed}</strong><small>${passRate}% of suite</small></article>
        <article class="metric"><span>Failed</span><strong>${failed}</strong><small>${failedRate}% of suite</small></article>
        <article class="metric"><span>Flaky</span><strong>${flaky}</strong><small>${flakyRate}% with retries</small></article>
        <article class="metric"><span>Duration</span><strong>${formatDuration(summary.durationMs)}</strong><small>latest run</small></article>
      </div>
      <div class="status-strip" aria-label="Status distribution">
        <div title="Passed"></div><div title="Flaky"></div><div title="Failed"></div><div title="Skipped"></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <h2>Executive Pack</h2>
          <p>Copy or export the evidence a reviewer needs without digging through raw test logs.</p>
        </div>
      </div>
      <div class="action-grid">
        <button type="button" data-print>Save PDF</button>
        <button type="button" data-copy="${escapeHtml(summaryText)}">Copy Summary</button>
        <button type="button" data-copy="${escapeHtml(allGherkin)}">Copy Gherkin</button>
        <a class="button-link" href="gherkin-cases.csv" download>Download CSV</a>
        <button type="button" data-copy="npm test" data-show-command>Copy Run Command</button>
      </div>
      <div id="runCommandPanel" class="revealed-command">
        <span>Run command copied</span>
        <code>npm test</code>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <h2>Dashboard Insights</h2>
          <p>Health distribution, business coverage, and stability trend in one readable view.</p>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="donut-panel">
          <h2>Suite Health</h2>
          <canvas id="statusDonut" class="donut" aria-label="Status distribution donut chart"></canvas>
          <div class="legend">${statusLegend}</div>
        </div>
        <div class="feature-health">
          <h2>Feature Health</h2>
          <div class="feature-health-list">${featureHealthBars}</div>
        </div>
        <div class="spark-panel">
          <h2>Stability</h2>
          <canvas id="confidenceSpark" class="spark" aria-label="Confidence stability sparkline"></canvas>
          <div class="trend-kpis">
            <div class="trend-kpi"><span>Current</span><strong>${summary.confidenceScore}</strong></div>
            <div class="trend-kpi"><span>Best</span><strong>${Math.max(...history.map((run) => run.confidenceScore), summary.confidenceScore)}</strong></div>
            <div class="trend-kpi"><span>Runs</span><strong>${history.length}</strong></div>
          </div>
        </div>
      </div>
    </section>

    <section class="executive-grid section">
      <div>
        <div class="section-head">
          <div>
            <h2>Business Coverage</h2>
            <p>Feature-level proof with pass health at a glance.</p>
          </div>
        </div>
        <div class="features">${featureCards}</div>
      </div>
      <div>
        <div class="section-head">
          <div>
            <h2>Risk Radar</h2>
            <p>What needs attention before anyone trusts a release.</p>
          </div>
        </div>
        <div class="risk-list">${riskRows}</div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <h2>Evidence Library</h2>
          <p>Search, filter, copy Gherkin, copy CSV rows, or rerun a single case.</p>
        </div>
      </div>
      <div class="toolbar">
        <input id="caseSearch" type="search" placeholder="Search cases, suites, features, or tags">
        <div class="filters" aria-label="Scenario filters">
          <button type="button" class="active" data-filter="all">All</button>
          <button type="button" data-filter="passed">Passed</button>
          <button type="button" data-filter="flaky">Flaky</button>
          <button type="button" data-filter="failed">Failed</button>
          <button type="button" data-filter="skipped">Skipped</button>
        </div>
      </div>
      <div id="caseCount" class="case-count"></div>
      <div class="case-list">${scenarioCards}</div>
    </section>
  </div>
  <script>
    const values = [${trendValues}];
    const ratio = window.devicePixelRatio || 1;
    const spark = document.getElementById('confidenceSpark');
    const ctx = spark.getContext('2d');
    spark.width = spark.clientWidth * ratio;
    spark.height = spark.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    const width = spark.clientWidth;
    const height = spark.clientHeight;
    const pad = { top: 14, right: 12, bottom: 22, left: 30 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ecfdf3';
    ctx.fillRect(pad.left, pad.top, plotWidth, plotHeight * .1);
    ctx.fillStyle = '#fffaeb';
    ctx.fillRect(pad.left, pad.top + plotHeight * .1, plotWidth, plotHeight * .2);
    ctx.fillStyle = '#fef3f2';
    ctx.fillRect(pad.left, pad.top + plotHeight * .3, plotWidth, plotHeight * .7);
    ctx.strokeStyle = '#d9e2ec';
    ctx.lineWidth = 1;
    [100, 90, 70, 0].forEach(value => {
      const y = pad.top + (1 - value / 100) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#667085';
      ctx.font = '12px Segoe UI, Arial';
      ctx.fillText(String(value), 8, y + 4);
    });
    if (values.length) {
      const xStep = values.length === 1 ? 0 : plotWidth / (values.length - 1);
      const points = values.map((value, index) => ({
        x: values.length === 1 ? pad.left + plotWidth / 2 : pad.left + index * xStep,
        y: pad.top + (1 - value / 100) * plotHeight,
        value
      }));
      const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
      gradient.addColorStop(0, 'rgba(36, 87, 214, .28)');
      gradient.addColorStop(1, 'rgba(36, 87, 214, 0)');
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.lineTo(points.at(-1).x, height - pad.bottom);
      ctx.lineTo(points[0].x, height - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = '#2457d6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      points.forEach((point, index) => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2457d6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, index === points.length - 1 ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      const last = points.at(-1);
      ctx.fillStyle = '#101828';
      ctx.font = 'bold 13px Segoe UI, Arial';
      ctx.fillText('Latest ' + last.value, Math.min(last.x + 10, width - pad.right - 70), Math.max(last.y - 10, pad.top + 14));
    }

    const donut = document.getElementById('statusDonut');
    const donutCtx = donut.getContext('2d');
    donut.width = donut.clientWidth * ratio;
    donut.height = donut.clientHeight * ratio;
    donutCtx.scale(ratio, ratio);
    const donutValues = [
      { label: 'Passed', value: ${passed}, color: '#12805c' },
      { label: 'Flaky', value: ${flaky}, color: '#6941c6' },
      { label: 'Failed', value: ${failed}, color: '#b42318' },
      { label: 'Skipped', value: ${skipped}, color: '#b54708' }
    ];
    const donutTotal = Math.max(donutValues.reduce((sum, item) => sum + item.value, 0), 1);
    const cx = donut.clientWidth / 2;
    const cy = donut.clientHeight / 2;
    const radius = Math.min(cx, cy) - 12;
    let start = -Math.PI / 2;
    donutValues.forEach(item => {
      const slice = (item.value / donutTotal) * Math.PI * 2;
      donutCtx.beginPath();
      donutCtx.moveTo(cx, cy);
      donutCtx.arc(cx, cy, radius, start, start + slice);
      donutCtx.closePath();
      donutCtx.fillStyle = item.value ? item.color : '#e4e7ec';
      donutCtx.fill();
      start += slice;
    });
    donutCtx.beginPath();
    donutCtx.arc(cx, cy, radius * .62, 0, Math.PI * 2);
    donutCtx.fillStyle = '#ffffff';
    donutCtx.fill();
    donutCtx.fillStyle = '#101828';
    donutCtx.font = 'bold 34px Segoe UI, Arial';
    donutCtx.textAlign = 'center';
    donutCtx.fillText('${passRate}%', cx, cy - 2);
    donutCtx.fillStyle = '#667085';
    donutCtx.font = '12px Segoe UI, Arial';
    donutCtx.fillText('pass rate', cx, cy + 18);

    const search = document.getElementById('caseSearch');
    const filterButtons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('.case-card')];
    const count = document.getElementById('caseCount');
    let activeFilter = 'all';

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const matchesFilter = activeFilter === 'all' || card.dataset.status === activeFilter;
        const matchesSearch = !query || card.dataset.search.includes(query);
        const shouldShow = matchesFilter && matchesSearch;
        card.classList.toggle('hidden', !shouldShow);
        if (shouldShow) visible += 1;
      });
      count.textContent = visible + ' of ' + cards.length + ' evidence items shown';
    }

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        filterButtons.forEach(item => item.classList.toggle('active', item === button));
        applyFilters();
      });
    });
    search.addEventListener('input', applyFilters);
    applyFilters();

    document.querySelectorAll('[data-copy]').forEach(button => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copy;
        await navigator.clipboard.writeText(value).catch(() => {
          const textArea = document.createElement('textarea');
          textArea.value = value;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        });
        const original = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = original; }, 1200);
        if (button.dataset.showCommand !== undefined) {
          document.getElementById('runCommandPanel').classList.add('visible');
        }
      });
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

function renderSuiteCommands(features: string[]): string {
  const commands = [['All Cases', 'npm test'], ...features.map((feature) => [feature, `npx playwright test --grep "${feature.replaceAll('"', '\\"')}"`])];
  return commands
    .map(([label], index) => `<button type="button" data-copy-target="copy-command-${index}">${escapeHtml(label)}</button>`)
    .join('\n');
}

function renderSuiteCommandCopies(features: string[]): string {
  const commands = [['All Cases', 'npm test'], ...features.map((feature) => [feature, `npx playwright test --grep "${feature.replaceAll('"', '\\"')}"`])];
  return commands
    .map(([, command], index) => `<pre id="copy-command-${index}" class="hidden-copy">${escapeHtml(command)}</pre>`)
    .join('\n');
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
      <strong>${escapeHtml(shortCaseLabel(scenario))}</strong>
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
      const searchText = [scenario.title, scenario.feature, scenario.tags.join(' '), scenario.gherkin, status].join(' ').toLowerCase();

      return `
    <article class="case-card status-${scenario.statusGroup}" data-status="${status}" data-module="${escapeHtml(scenario.feature)}" data-search="${escapeHtml(searchText)}" hidden>
      <div class="case-header">
        <div>
          <div class="case-meta">${escapeHtml(shortCaseLabel(scenario))} | ${escapeHtml(scenario.feature)} | ${formatDuration(scenario.durationMs)}</div>
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

function moduleColor(index: number): string {
  return ['#f27a1a', '#17824a', '#2563eb', '#c43d32', '#9b6a00', '#7c3aed', '#0f766e', '#db2777', '#475569'][index % 9];
}

function statusDisplay(status: EnrichedScenario['statusGroup']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function shortCaseLabel(scenario: EnrichedScenario): string {
  const taggedId = scenario.tags.find((tag) => /^@[A-Z]{1,4}\d+$/i.test(tag))?.replace('@', '');
  if (taggedId) return taggedId;

  const caseName = scenario.title.split(' > ').at(-1) ?? 'case';
  const words = caseName.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function renderFeatureCards(scenarios: EnrichedScenario[]): string {
  return Object.entries(groupByFeature(scenarios))
    .map(([feature, featureScenarios]) => {
      const passed = featureScenarios.filter((scenario) => scenario.statusGroup === 'passed' || scenario.statusGroup === 'flaky').length;
      const health = percentage(passed, Math.max(featureScenarios.length, 1));
      return `<article class="feature-card">
        <strong>${escapeHtml(feature)}</strong>
        <span>${passed}/${featureScenarios.length} passing evidence items</span>
        <div class="feature-bar"><div style="width:${health}%"></div></div>
      </article>`;
    })
    .join('');
}

function renderFeatureHealthBars(scenarios: EnrichedScenario[]): string {
  return Object.entries(groupByFeature(scenarios))
    .map(([feature, featureScenarios]) => {
      const total = Math.max(featureScenarios.length, 1);
      const passed = featureScenarios.filter((scenario) => scenario.statusGroup === 'passed').length;
      const flaky = featureScenarios.filter((scenario) => scenario.statusGroup === 'flaky').length;
      const failed = featureScenarios.filter((scenario) => scenario.statusGroup === 'failed').length;
      const skipped = featureScenarios.filter((scenario) => scenario.statusGroup === 'skipped').length;
      const healthy = percentage(passed + flaky, total);

      return `<div class="health-row">
        <div class="health-top"><strong>${escapeHtml(feature)}</strong><span>${healthy}% healthy | ${failed} risk</span></div>
        <div class="health-track" aria-label="${escapeHtml(feature)} health">
          <div class="health-pass" style="width:${percentage(passed, total)}%"></div>
          <div class="health-flaky" style="width:${percentage(flaky, total)}%"></div>
          <div class="health-failed" style="width:${percentage(failed, total)}%"></div>
          <div style="width:${percentage(skipped, total)}%"></div>
        </div>
      </div>`;
    })
    .join('');
}

function renderStatusLegend(status: { passed: number; failed: number; flaky: number; skipped: number }): string {
  return [
    { label: 'Passed', value: status.passed, color: '#12805c' },
    { label: 'Flaky', value: status.flaky, color: '#6941c6' },
    { label: 'Failed', value: status.failed, color: '#b42318' },
    { label: 'Skipped', value: status.skipped, color: '#b54708' }
  ]
    .map((item) => `<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join('');
}

function renderRiskRows(scenarios: EnrichedScenario[]): string {
  const grouped = Object.entries(groupByFeature(scenarios));
  if (!grouped.length) {
    return '<div class="risk-item"><div><strong>No scenarios found</strong><span>Run the suite to populate report evidence.</span></div><span class="risk-badge high">No data</span></div>';
  }

  return grouped
    .map(([feature, featureScenarios]) => {
      const failed = featureScenarios.filter((scenario) => scenario.statusGroup === 'failed').length;
      const flaky = featureScenarios.filter((scenario) => scenario.statusGroup === 'flaky').length;
      const riskClass = failed > 0 ? 'high' : 'low';
      const riskLabel = failed > 0 ? 'Review' : 'Clear';
      const detail = failed > 0 ? `${failed} failing, ${flaky} flaky` : `${featureScenarios.length} checked, ${flaky} flaky`;
      return `<div class="risk-item"><div><strong>${escapeHtml(feature)}</strong><span>${escapeHtml(detail)}</span></div><span class="risk-badge ${riskClass}">${riskLabel}</span></div>`;
    })
    .join('');
}

function renderScenarioCards(scenarios: EnrichedScenario[]): string {
  return scenarios
    .map((scenario) => {
      return `<article class="case-card" data-status="${scenario.statusGroup}" data-feature="${escapeHtml(scenario.feature.toLowerCase())}" data-search="${escapeHtml(`${scenario.title} ${scenario.feature} ${scenario.tags.join(' ')}`.toLowerCase())}">
        <div class="case-main">
          <div>
            <div class="case-title">${escapeHtml(scenario.title)}</div>
            <div class="case-meta">${escapeHtml(scenario.feature)} | ${formatDuration(scenario.durationMs)} | ${scenario.attempts} attempt${scenario.attempts === 1 ? '' : 's'} | ${escapeHtml(scenario.tags.join(', ') || 'untagged')}</div>
          </div>
          <span class="status ${scenario.statusGroup}">${escapeHtml(scenario.statusGroup)}</span>
        </div>
        <details>
          <summary>Open Gherkin evidence</summary>
          <pre>${escapeHtml(scenario.gherkin)}</pre>
        </details>
        ${scenario.error ? `<details><summary>Failure evidence</summary><pre>${escapeHtml(scenario.error)}</pre></details>` : ''}
        <div class="case-actions">
          <button type="button" data-copy="${escapeHtml(scenario.gherkin)}">Copy Gherkin</button>
          <button type="button" data-copy="${escapeHtml(scenario.csvRow)}">Copy CSV Row</button>
        </div>
        <div class="command-row">
          <code>${escapeHtml(scenario.command)}</code>
          <button type="button" data-copy="${escapeHtml(scenario.command)}">Copy Run Command</button>
        </div>
      </article>`;
    })
    .join('');
}

function executiveVerdict(summary: RunSummary, flaky: number): { title: string; body: string } {
  if (summary.failed > 0) {
    return {
      title: 'Action required before release confidence can be claimed.',
      body: `${summary.failed} scenario(s) failed. The report preserves business-readable evidence and technical rerun commands for focused investigation.`
    };
  }

  if (flaky > 0) {
    return {
      title: 'Release confidence is positive, with stability watch items.',
      body: `${flaky} scenario(s) required retry evidence. Functional outcomes passed, but stability should be monitored before high-risk release decisions.`
    };
  }

  return {
    title: 'Release confidence is strong.',
    body: 'All automated business journeys passed in the latest headless run with no flaky evidence recorded.'
  };
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function scoreColor(score: number): string {
  if (score >= 90) return '#12805c';
  if (score >= 70) return '#b54708';
  return '#b42318';
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
    `Total scenarios: ${summary.total}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Skipped: ${summary.skipped}`,
    `Flaky: ${flaky}`,
    `Duration: ${formatDuration(summary.durationMs)}`,
    `Status: ${statusLabel(summary)}`
  ].join('\n');
}

function buildGherkinCsv(scenarios: EnrichedScenario[]): string {
  const header = ['Feature', 'Scenario', 'Status', 'Attempts', 'Duration', 'Tags', 'Run Command', 'Gherkin'].map(csvEscape).join(',');
  return [header, ...scenarios.map((scenario) => scenario.csvRow)].join('\n');
}

function scenarioCsvRow(scenario: Omit<EnrichedScenario, 'csvRow'>): string {
  return [
    scenario.feature,
    scenario.title,
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

function featureFromFile(file: string): string {
  const source = file.toLowerCase();
  if (source.includes('auth')) return 'Authentication';
  if (source.includes('cart')) return 'Cart';
  if (source.includes('category')) return 'Category';
  if (source.includes('checkout')) return 'Checkout';
  if (source.includes('contact')) return 'Support';
  if (source.includes('navigation')) return 'Navigation';
  if (source.includes('products')) return 'Product Discovery';
  if (source.includes('home')) return 'Home Experience';
  return 'General';
}

function cleanTitle(title: string): string {
  return title.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();
}

function extractTags(title: string): string[] {
  return title.match(/@\w+/g) ?? [];
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

function scenarioStatusGroup(scenario: ScenarioResult): 'passed' | 'flaky' | 'failed' | 'skipped' {
  if (scenario.status === 'skipped') return 'skipped';
  if (scenario.status === 'passed' && scenario.attempts > 1) return 'flaky';
  if (scenario.status === 'passed') return 'passed';
  return 'failed';
}

function runCommandForScenario(scenario: ScenarioResult): string {
  const file = scenario.file ? ` ${scenario.file}` : '';
  const caseName = scenario.title.split(' > ').at(-1) ?? scenario.title;
  return `npx playwright test${file} --grep "${caseName.replaceAll('"', '\\"')}"`;
}

function normalizeFilePath(file: string): string {
  return file.replaceAll('\\', '/');
}

function gherkinForScenario(scenario: ScenarioResult): string {
  const title = scenario.title.toLowerCase();
  const feature = scenario.feature;
  const scenarioName = scenario.title.split(' > ').at(-1) ?? scenario.title;
  const common = `Feature: ${feature}\n\nScenario: ${scenarioName}`;

  if (title.includes('register') && title.includes('delete')) {
    return `${common}\n  Given a visitor opens the ecommerce site\n  When the visitor signs up with unique customer details\n  Then the account is created and the customer is logged in\n  And the account can be deleted as test cleanup`;
  }
  if (title.includes('invalid login')) {
    return `${common}\n  Given a visitor opens the login page\n  When invalid credentials are submitted\n  Then the application shows a clear authentication error`;
  }
  if (title.includes('home page loads')) {
    return `${common}\n  Given a visitor opens the site\n  Then the home page loads successfully\n  And the primary navigation is visible`;
  }
  if (title.includes('subscribe')) {
    return `${common}\n  Given a visitor is on the home page\n  When a valid email is submitted in the subscription form\n  Then the visitor sees a successful subscription confirmation`;
  }
  if (title.includes('product details')) {
    return `${common}\n  Given a shopper opens the products catalogue\n  When the shopper opens the first product details page\n  Then product name, category, price, availability, condition, and brand details are available`;
  }
  if (title.includes('search')) {
    return `${common}\n  Given a shopper opens the products catalogue\n  When the shopper searches for a known product\n  Then relevant searched products are displayed`;
  }
  if (title.includes('add multiple products')) {
    return `${common}\n  Given a shopper opens the products catalogue\n  When the shopper adds two products to the cart\n  Then both products are visible in the cart with correct quantities`;
  }
  if (title.includes('remove a product')) {
    return `${common}\n  Given a shopper has a product in the cart\n  When the shopper removes that product\n  Then the cart no longer shows the removed product`;
  }
  if (title.includes('contact form')) {
    return `${common}\n  Given a visitor opens the contact page\n  When the visitor submits contact details with an attachment\n  Then the site confirms the message was submitted successfully`;
  }
  if (title.includes('place an order')) {
    return `${common}\n  Given a registered shopper has a product in the cart\n  When the shopper completes checkout and payment\n  Then the order is placed successfully\n  And the created account is removed as test cleanup`;
  }

  return `${common}\n  Given the user is in the relevant application area\n  When the automated scenario performs the business action\n  Then the expected business outcome is verified`;
}

if (require.main === module) {
  void buildBusinessReport();
}
