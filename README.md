# Automation Exercise Playwright Portfolio

[![Full Regression And Business Report](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/workflows/full-regression.yml/badge.svg)](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/workflows/full-regression.yml)

## 30-Second Review

- Start here: [live business dashboard](https://TugceAcir.github.io/automationexercise-playwright-portfolio/) -> [latest full-regression workflow](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/workflows/full-regression.yml) -> [test strategy](docs/test-strategy.md).
- This project shows manual QA judgment supported by AI-assisted automation: I chose the business risks, directed the implementation, reviewed the generated code, and validated the evidence.
- The suite reports public-demo-site instability instead of hiding it, so recruiters and QA leads can separate product/test risks from environment noise.

This repository is a production-style UI test automation portfolio for [Automation Exercise](https://automationexercise.com/). It uses Playwright, TypeScript, page objects, generated test data, CI execution, technical reports, and a custom business dashboard that refreshes after every test run.

Maintained by [Tugce Acir](https://github.com/TugceAcir).

I built this as a manual tester using AI as an engineering assistant. I defined the test strategy, selected the business risks, reviewed generated code, validated behavior against the live site, and kept the evidence readable for both technical and non-technical reviewers.

## Why This Project Stands Out

- The suite runs with conservative worker defaults because the target is a public demo site where aggressive parallelism can create noisy failures.
- Page objects centralize established page behaviors, while shared helpers handle repeated cross-page flows. Some scenario-specific selectors remain in specs and are tracked for incremental consolidation.
- Generated users avoid shared credentials and make account, cart, and checkout flows safe to rerun.
- The strategy keeps meaningful UI failures visible instead of bypassing them with direct route fallbacks.
- Playwright traces, screenshots, videos, a triage summary, and HTML reports support technical debugging.
- A custom business report translates raw automation results into release confidence, feature risk, and scenario evidence.
- Documentation explains how AI was used as an accelerator while human review owns the risk judgment and final evidence.

## Tech Stack

- Playwright Test
- TypeScript
- ESLint
- GitHub Actions
- GitHub Pages
- Custom HTML business reporter

## Getting Started

Requires Node.js 22.x.

```bash
npm install
npx playwright install chromium firefox webkit
npm test
```

Optional environment configuration:

```bash
BASE_URL=https://automationexercise.com
WORKERS=1
```

`fullyParallel` is enabled in Playwright, but the configured worker count is intentionally conservative: local runs default to 1 worker, and CI sets `WORKERS=1` for live-site gates. This keeps the public demo site from creating noisy failures while still allowing controlled parallel execution.

The default test command runs the full UI E2E suite in headless Chromium, Firefox, and WebKit. Regenerate the portfolio dashboard afterward with `npm run business-report`, which refreshes:

```text
business-report/index.html
```

## Useful Commands

```bash
npm test                 # Run all tests headlessly
npm run test:chromium    # Run all tests in Chromium only
npm run test:firefox     # Run all tests in Firefox only
npm run test:webkit      # Run all tests in WebKit only
npm run test:smoke       # Run smoke tests only
npm run test:cross-platform # Run the focused smoke and session compatibility set
npm run test:regression  # Run regression tests only
npm run test:a11y        # Run informational WCAG 2.1 A/AA scans in Chromium
npm run test:headed      # Debug in headed browser mode
npm run test:ui          # Use Playwright UI mode
npm run report           # Open Playwright technical HTML report
npm run business-report  # Regenerate the business dashboard from latest JSON results
npm run demo-site:preflight # Check the public demo site is reachable before a run
npm run triage:failures  # Summarize and classify failure evidence after a failed run
npm run coverage:counts  # Regenerate README and AGENTS scenario counts
npm run coverage:check   # Verify generated scenario counts are current
npm run test:unit        # Unit-test the report tooling (scoring, Gherkin, enrichment)
npm run typecheck        # Validate TypeScript
npm run lint             # Validate code style
```

## Coverage

<!-- coverage:start -->
Last generated UI E2E suite snapshot: 70 scenarios. Cross-browser execution runs those scenarios across 3 browser projects for 210 browser-scenario executions.

| Business Area | Tests |
| --- | ---: |
| Authentication | 9 |
| Cart | 13 |
| Categories | 4 |
| Checkout | 12 |
| Support | 7 |
| Home Experience | 10 |
| Navigation | 3 |
| Product Discovery | 12 |
<!-- coverage:end -->

The suite intentionally keeps one strong version of each behavior. Low-value duplicates, such as repeated tab-close checks on stateless public pages, are removed so the suite stays easier to explain and maintain.

## Reviewer Path

If you have five minutes to review this portfolio, start with the GitHub Actions badge and latest workflow run, then open the live business dashboard. For implementation quality, read the test strategy, the environment-resilience ADR, and one page object such as `pages/CartPage.ts`. For failure handling, inspect `npm run triage:failures` output or the failed-run GitHub summary.

## Reporting

After each run, Playwright creates two report layers:

- `playwright-report/`: technical report with traces and failure evidence.
- `business-report/index.html`: portfolio-facing dashboard for recruiters and QA leads.

The business report includes a portfolio risk indicator, feature coverage, browser coverage, failed scenario risk, duration, attempts, WCAG 2.1 A/AA accessibility baseline results, and a local trend from `business-report/history.json`.

The trend compares full-regression runs only. Focused runs are still recorded in the history file but are excluded from the trend, so a single-scenario rerun cannot score the same as a complete 210 browser-scenario run. The dashboard states how many comparable runs the trend is based on.

The current risk indicator starts from pass rate, then subtracts 12 points per failure needing review, 4 points per environment-classified public-demo failure, and 4 points per skipped scenario. Treat it as a transparent triage signal for portfolio review, not as a release guarantee or a substitute for trace review.

The target application is a public demo site. Queue-full pages, transient `500`/`503`/`520` responses, blank/error bodies, and navigation timeouts are classified as environment risk when the evidence matches those signatures. The suite reports that risk instead of hiding it with direct route fallbacks.

## Business Dashboard Preview

The dashboard is published from successful `main` runs when dashboard publishing is enabled (see the `PUBLISH_DASHBOARD` variable in [AGENTS.md](AGENTS.md)):

- [Open the business dashboard](https://TugceAcir.github.io/automationexercise-playwright-portfolio/)

![Business dashboard preview](docs/assets/business-dashboard.png)

The screenshot previews the dashboard layout. The generated `business-report/index.html` file and the GitHub Pages dashboard are the current source of truth after each run.

## CI/CD

GitHub Actions separates merge confidence from full regression evidence. Pull requests to `main` run static checks, unit tests, coverage freshness, accessibility scans, and the focused `@smoke|@session` gate on Ubuntu with conservative workers and retries. A separate full-regression workflow runs the complete 210 browser-scenario suite on pushes to `main`, a Thursday schedule, and manual dispatch. Pushes and manual dispatches also publish the business dashboard; scheduled runs produce evidence without republishing. Live-site workflows share a single concurrency group so Dependabot, PR, and regression runs do not overload the public demo site. Windows and macOS compatibility continue to run the focused `@smoke|@session` set every Monday and on manual dispatch.

The pipeline validates:

- TypeScript compilation
- ESLint rules
- Focused Playwright UI E2E smoke/session gate across Chromium, Firefox, and WebKit
- Informational WCAG 2.1 A/AA accessibility scans in Chromium
- Full regression across 70 scenarios and 3 browser projects on pushes to `main`, schedule, or manual dispatch

The quality-gate workflow uploads Playwright, accessibility, and raw test artifacts when a run fails, so evidence exists for triage without storing artifacts for every green run. Full-regression runs always upload the business report, and upload Playwright reports and raw test results on failure. Successful full-regression pushes to `main`, and manual dispatches, publish `business-report/` to GitHub Pages when the `PUBLISH_DASHBOARD` repository variable is `true`, so the portfolio dashboard can be opened from the repository's Pages URL:

- Repository: [TugceAcir/automationexercise-playwright-portfolio](https://github.com/TugceAcir/automationexercise-playwright-portfolio)
- CI/CD workflow: [Full Regression And Business Report](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/workflows/full-regression.yml)
- Business dashboard: [GitHub Pages report](https://TugceAcir.github.io/automationexercise-playwright-portfolio/)

The same business dashboard is also available as a downloadable workflow artifact from each full-regression run.

## AI-Assisted Testing

See [docs/ai-testing-workflow.md](docs/ai-testing-workflow.md) for the workflow used to turn AI assistance into reviewed, maintainable automation instead of blind code generation.

## Extending And Debugging

- [Agent handoff](AGENTS.md) - architecture rules, suite map, current status, and next priorities
- [Test strategy](docs/test-strategy.md)
- [Environment resilience ADR](docs/adr/0001-environment-resilience-boundary.md)
- [AI-assisted testing workflow](docs/ai-testing-workflow.md)
- [Contributing workflow](CONTRIBUTING.md)

## License

MIT - see [LICENSE](LICENSE).
