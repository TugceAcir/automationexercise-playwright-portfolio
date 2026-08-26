# Test Strategy

## Objective

Prove that high-value ecommerce journeys on Automation Exercise can be automated with maintainable Playwright TypeScript code and business-readable reporting.

This strategy reflects my manual QA judgment. I used AI to accelerate implementation and compare options, but I selected the risks, challenged generated code, validated behavior against the live site, and kept the evidence understandable for recruiters, QA leads, and engineers.

## Scope

The first portfolio version covers UI E2E flows only. API tests are intentionally left out so the repository can stay focused and stable.

Before API testing starts, the project should prove that the UI suite is not only automated, but operated like a real quality system: protected by CI, readable in business terms, reviewed with intent, and connected to defect triage.

## Design Principles

- Write tests in business language and hide UI mechanics in page objects.
- Generate unique user data for account and checkout flows.
- Keep browser execution headless by default.
- Capture traces, screenshots, and videos only when they add debugging value.
- Prefer accessible locators and stable app attributes; use scoped CSS selectors when the demo site has limited accessibility metadata.
- Clean up created accounts during the test flow where supported by the application.

## Automation Architecture

The framework separates responsibilities so tests stay readable as coverage grows:

- Specs describe business scenarios, tags, and scenario-level assertions.
- Page objects model what a user can do or verify on a specific page.
- Shared helpers handle repeated cross-flow setup such as registration, login, account cleanup, cart seeding, and HTML5 validation checks.
- Fixtures provide reusable page object instances and narrow automatic setup.
- Test data factories create unique data so account and checkout tests can be rerun safely.

Cross-page orchestration should not drift into page objects. If a flow spans multiple pages and more than one suite needs it, move it to a shared helper.

Environment resilience has one boundary: `pages/app-navigation.ts`. Confirmed transient public-demo-site failures may be retried there, while page objects and shared support helpers must keep user actions honest. See [ADR 0001](adr/0001-environment-resilience-boundary.md).

## Locator Strategy

Locator choice is part of reliability. Prefer this order:

1. Accessible role/name locators for controls and user-visible actions.
2. Stable app attributes such as `data-qa` when the site provides them.
3. Scoped CSS selectors inside meaningful page sections when accessibility metadata is limited.

Avoid brittle full DOM chains, unscoped indexes, and selectors copied from DevTools without checking whether they express user intent. When scoped CSS is unavoidable, pair it with a visible assertion that proves the page state.

## Quality Gates

The `main` branch should represent a trustworthy version of the framework. Changes are expected to pass the same checks locally and in CI:

- TypeScript typecheck.
- ESLint.
- Playwright focused smoke/session execution for pull-request confidence.
- Business report generation.

GitHub Actions separates merge confidence from full regression evidence. The Ubuntu pull-request workflow proves the suite compiles, follows code-quality rules, runs the focused `@smoke|@session` gate in Chromium, Firefox, and WebKit, and produces technical evidence. A full-regression workflow runs the complete 210 browser-scenario suite after merges to `main`, on schedule, and on manual dispatch. Merges and manual dispatches also publish the business dashboard when the `PUBLISH_DASHBOARD` repository variable is `true`; scheduled runs produce evidence without republishing. Live-site workflows use a shared concurrency group so Dependabot, pull-request, and full-regression runs do not execute against the public demo site at the same time. A weekly or manually dispatched Windows/macOS workflow runs the focused smoke and session compatibility set without tripling public-site traffic on every change.

## Pull Request Workflow

Even when working solo, changes should be developed through short-lived branches and pull requests. This demonstrates team-ready automation habits:

- Keep `main` protected as the stable branch.
- Use PRs to explain the user risk, changed coverage, and validation evidence.
- Review generated reports before merging.
- Treat CI failures as investigation signals, not noise.

## Test Taxonomy

Tags describe the role of each scenario:

| Tag | Purpose |
| --- | --- |
| `@smoke` | Fast confidence that a core journey is alive. |
| `@regression` | Deeper coverage for important ecommerce behavior. |
| `@negative` | Validation, blocked actions, and failure behavior. |
| `@edge` | Boundary or less common but meaningful user behavior. |
| `@session` | Refresh, browser-back, and state persistence behavior. |

This tag strategy makes the suite easier to run, explain, and scale.

## Accessibility Testing

The project runs five representative automated accessibility scans in Chromium: home, product listing/search results, product detail, a populated cart, and authenticated checkout. Run them separately with `npm run test:a11y`; they are not included in the 70 functional scenarios or 210 cross-browser executions.

The scans use axe and explicitly target WCAG 2.1 Level A and AA rules through the `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa` tags. Axe is an automated accessibility rules engine. It finds programmatically detectable problems such as missing accessible names, invalid ARIA, structural issues, and some color-contrast failures, but it does not establish complete WCAG conformance.

Each known finding is fingerprinted by `(page state, axe rule ID)`. A rule already documented on home is therefore still a regression if it first appears on cart. New fingerprints fail their scan with rule, impact, affected-node, and help-link evidence. Removed fingerprints produce a warning without failing, because they may represent a genuine site fix; the stale baseline entry should then be reviewed. Tests never update the baseline automatically. Adding or removing a fingerprint requires a reviewed change to `tests/accessibility/accessibility-baseline.ts` with evidence and a written rationale.

The suite reuses normal UI setup for stateful pages and blocks known advertising traffic. If consecutive scans differ, third-party iframe leakage is the first condition to verify. The CI job is informational by design and cannot block the functional workflow or Pages deployment because this repository does not own the target application.

Accessibility scans use their own traceable taxonomy: `@A11Y001` through `@A11Y005` are stable case IDs, `@accessibility` identifies the coverage area, `@wcag21aa` declares WCAG 2.1 Level A/AA scope, and `@regression` describes fingerprint regression detection. Positive, negative, edge, and session tags are not applied because these scans evaluate standards risk for representative page states rather than functional-path categories.

The accessibility reporter writes a machine-readable summary for the business dashboard. That panel remains separate from functional pass rate, module health, confidence scoring, and the 70/210 coverage totals. Known baseline rule IDs are displayed honestly as existing findings rather than being presented as zero violations.

Manual review remains necessary for keyboard-only operation, visible and logical focus order, keyboard traps, screen-reader flow, meaningful alternative-text quality, and understandable labels and error messages. Automated results are evidence of regression coverage, not a claim of accessibility certification.

## Coverage Matrix

This matrix summarizes the distinct risks covered by the 70 UI scenarios. "Positive" groups the successful journeys tagged as smoke or regression; the other columns follow the suite taxonomy above. Detailed scenario IDs and expected results remain in the generated business report and Gherkin export.

| Area | Positive paths | Negative paths | Edge cases | Session and resilience |
| --- | --- | --- | --- | --- |
| Authentication (9) | Register and delete account; logout and login again | Invalid login; required login fields; invalid signup email; duplicate email | Names containing spaces and punctuation | Refresh and browser-back preserve login |
| Cart (13) | Add and remove products; selected quantity; price and line total; cart after login; subscription | Empty cart hides checkout | Remove last item; add the same item twice; recommended item | Refresh, browser-back, and browser-context restart preserve cart |
| Checkout (12) | Registered, register-during-checkout, and login-before-checkout paths; multiple-product review; address match; order placement; invoice | Guest checkout prompt; required payment fields | Long order comment | Refresh, browser-back, and browser-context restart preserve checkout |
| Product discovery (12) | Product list and details; exact search; search-to-detail; brand switching; review submission | No-result search; invalid product route; required and valid review email | Partial search | Refresh and browser-back preserve a healthy product journey |
| Home experience (10) | Core navigation; product discovery sections; subscription | Required and valid subscription email | Plus-address subscription; scroll controls | Refresh and browser-back return a healthy home page |
| Customer support (7) | Contact submission; attachment selection | Required and valid contact email | Long message with punctuation | Refresh clears the form; browser-back leaves it usable |
| Categories (4) | Women, men, and kids category browsing | Invalid category route | Nested kids category | Not stateful; session checks are intentionally omitted |
| Navigation (3) | Test Cases and API Testing pages | Not applicable to static links | External tutorial destination | Not stateful; session checks are intentionally omitted |

The blank negative and session areas for static navigation are deliberate, not missing coverage. New cases should be added only when they represent a distinct stakeholder risk rather than filling a matrix cell.

## Auth State Strategy

The suite intentionally separates auth lifecycle tests from tests that merely need an authenticated customer.

Current account-heavy flows create fresh users because registration data, cart state, checkout addresses, and cleanup are part of the evidence. A shared `storageState` user would be considered only for future tests that need a generic logged-in customer without validating registration, login, address, or cleanup behavior.

This avoids a common automation trap: speeding up tests by hiding the very account state the test is supposed to prove.

## Risk Management

The target is a public demo website, so network latency, third-party consent surfaces, and occasional availability issues can affect stability. The framework mitigates this with centralized navigation resilience, retries in CI, explicit waits through Playwright assertions, isolated browser contexts, and diagnostic artifacts.

Retries are diagnostic support, not a way to hide weak tests. Retry-recovered scenarios are surfaced as flaky in the business report. If a test is repeatedly flaky, it should be reviewed for locator quality, timing assumptions, third-party noise, test data dependency, and whether it is proving a valuable risk.

Retries also respect action safety. Login may be repeated after a confirmed transient failure because it is idempotent for this application. Signup, account creation, and payment submission are not automatically repeated because their server-side outcome may be uncertain.

Cross-browser action hardening distinguishes an uncommitted click from an uncertain server result. If an action emits no matching application request, the same UI action may be attempted once more. If a non-idempotent POST was emitted, the framework does not repeat it. Cart additions may repeat the same product and quantity after a confirmed 5xx response because the requested cart state is idempotent.

Cleanup receives the generated user's credentials so an expired session can be restored before deletion. Browser-history scenarios assert portable application behavior: a restored form must be healthy and usable, while preservation of an unsaved draft is left to browser history policy.

Cross-browser failures are classified before fixes are made. A Firefox or WebKit failure may reveal a real product compatibility issue, a test assumption that only worked in Chromium, an environment issue on the public demo site, or a data/cleanup problem.

## Failure Triage Model

A failing automated test should be classified before action is taken:

| Classification | Meaning |
| --- | --- |
| Product defect | The application behavior is wrong from a user or business perspective. |
| Test defect | The automation no longer represents the intended user behavior. |
| Environment issue | The public demo site, network, ads, or infrastructure affected execution. |
| Data issue | The failure depends on account state, generated data, or cleanup behavior. |

The goal is to turn failure into useful information quickly: what broke, who cares, how severe it is, and what evidence supports the conclusion.

## Debugging Runbook

Start with the smallest useful reproduction:

```bash
npx playwright test tests/e2e/cart.spec.ts -g "test title"
```

If the failure is visual or timing-sensitive, rerun headed:

```bash
npx playwright test tests/e2e/cart.spec.ts -g "test title" --headed
```

Then open the technical report and inspect the evidence in order:

```bash
npm run report
```

1. Error message and failing assertion.
2. Trace timeline.
3. Screenshot.
4. Video.
5. Network or navigation timing if the failure looks environmental.

Generate the concise failure summary after failed Playwright runs:

```bash
npm run triage:failures
```

Before closing a failure, run the focused test and then the affected suite. For shared helper or page object changes, run the full suite.

## Automation Review Rubric

Every new or changed test should answer these questions:

- Does it prove a distinct user or business risk?
- Would a stakeholder care if this failed?
- Is the assertion specific enough to diagnose the failure?
- Is the selector strategy stable and readable?
- Does the test avoid unnecessary duplication?
- Does it clean up data when the application allows it?
- Can the failure be explained through traces, screenshots, videos, or the business report?

## Reporting Strategy

The Playwright HTML report is the technical source of truth. The custom business report is the stakeholder layer, summarizing portfolio risk, feature risk, scenario status, and trend data after every run.

The confidence trend compares **full-regression runs only** — those covering the complete browser-scenario count. Focused runs, such as a single-scenario rerun or a tagged subset, are still recorded in `business-report/history.json` but are excluded from the trend, and the dashboard states how many comparable runs the trend is built from. Without that filter a 1-scenario run would score identically to a 210-scenario run and inflate both the best-ever figure and the clean-run streak. The trend rows are labelled as the latest and best *full-regression* run rather than as the current run, because the newest full regression may be older than the run being displayed elsewhere on the page.

The current dashboard risk indicator starts from pass rate, then subtracts 12 points for each failure needing review, 4 points for each environment-classified public-demo failure, and 4 points for each skipped scenario. It is intentionally transparent and easy to explain, but it should be treated as a triage signal rather than a release guarantee. A future scoring model should move toward weighted risk by scenario criticality, flaky status, skipped coverage, and browser coverage.

Cross-browser reporting is intentionally counted as browser-scenario executions: 70 scenarios across Chromium, Firefox, and WebKit produce 210 report rows. This makes browser-specific risk visible instead of hiding it behind a single collapsed scenario.

Parallel execution is allowed by config, but worker defaults stay conservative for the public demo site: 1 worker locally and CI workflows override heavy public-site gates to 1 worker. Retries default to 0 locally and 2 in CI unless `RETRIES` overrides the value. The small worker count matters more because the full suite exercises three browser engines against a site this repository does not control.

Cross-platform compatibility uses a targeted matrix rather than a full three-OS suite on every push. Windows and macOS run `@smoke|@session` with one worker and one diagnostic retry on a weekly schedule or manual dispatch. Each E2E job records its OS, architecture, Node version, Playwright version, worker count, retry count, commit, and base URL so local and CI evidence can be compared accurately.

## Defect Workflow And Issue Integration

The repository includes a failure-triage foundation through `npm run triage:failures`. It reads the Playwright JSON report and writes `test-results/failure-triage.json` plus `test-results/failure-triage.md`, summarizing failed scenarios by suite, tag, error, retry status, likely environment classification, and available evidence.

Future Jira or GitHub Issues automation should use that triage output as the evidence source, but ticket creation should remain opt-in and controlled. It should avoid duplicates, skip cancelled runs, include CI/report links, and preserve the automated environment-vs-review split while leaving product, test, and data classification to human triage.

Until that integration exists, issue creation should be described as a roadmap item rather than current behavior.
