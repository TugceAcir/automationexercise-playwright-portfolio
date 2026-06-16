# Test Strategy

## Objective

Prove that high-value ecommerce journeys on Automation Exercise can be automated with maintainable Playwright TypeScript code and business-readable reporting.

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
- Playwright E2E execution.
- Business report generation.

GitHub Actions is the release confidence gate. A green workflow means the suite compiles, follows code-quality rules, executes against the target site, and produces technical and business-readable evidence.

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

## Auth State Strategy

The suite intentionally separates auth lifecycle tests from tests that merely need an authenticated customer.

Current account-heavy flows create fresh users because registration data, cart state, checkout addresses, and cleanup are part of the evidence. A shared `storageState` user would be considered only for future tests that need a generic logged-in customer without validating registration, login, address, or cleanup behavior.

This avoids a common automation trap: speeding up tests by hiding the very account state the test is supposed to prove.

## Risk Management

The target is a public demo website, so network latency, third-party consent surfaces, and occasional availability issues can affect stability. The framework mitigates this with retries in CI, explicit waits through Playwright assertions, isolated browser contexts, and diagnostic artifacts.

Retries are diagnostic support, not a way to hide weak tests. If a test is repeatedly flaky, it should be reviewed for locator quality, timing assumptions, third-party noise, test data dependency, and whether it is proving a valuable risk.

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

The Playwright HTML report is the technical source of truth. The custom business report is the stakeholder layer, summarizing confidence, feature risk, scenario status, and trend data after every run.

The dashboard confidence score starts from pass rate, then subtracts 12 points for each failed scenario and 4 points for each skipped scenario. It is meant to prioritize review; it does not replace trace review or failure classification.

Parallel execution is allowed by config, but worker defaults stay conservative for the public demo site: 1 worker locally and 2 workers in CI unless `WORKERS` overrides the value.

## Defect Workflow And Jira Integration

The next maturity step is automatic defect creation when CI confirms a real failure. The preferred flow is:

1. Playwright fails in GitHub Actions.
2. The workflow uploads traces, screenshots, videos, raw JSON results, and the business report.
3. A triage step summarizes failed scenarios by suite, tag, error, retry status, and artifact links.
4. A Jira issue is created only for confirmed failures that are not already known.
5. The issue includes business impact, technical evidence, reproduction notes, CI run link, and report links.

For this repository, Jira automation should be implemented through a Jira MCP server when one is available in the working environment. Until a Jira MCP connection is configured, the practical fallback is a GitHub Actions step that calls the Jira REST API using repository secrets for the Jira site URL, user email, API token, project key, and issue type.

Automatic ticket creation should be controlled carefully. It should avoid duplicate tickets, avoid creating issues for cancelled runs, and clearly label whether the failure appears to be product, test, environment, or data related.

The repository now includes a failure-triage foundation through `npm run triage:failures`. It reads the Playwright JSON report and writes `test-results/failure-triage.json` plus `test-results/failure-triage.md`, which can later become the Jira MCP or Jira REST payload source.
