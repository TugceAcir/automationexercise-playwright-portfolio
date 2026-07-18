# AI-Assisted Testing Workflow

## Positioning

AI is used as an expert assistant for speed, structure, and review. It does not replace test judgment. Every generated idea, locator, assertion, and abstraction is validated against the running application.

## Human Ownership

The human tester owns the risk judgment. AI can propose scenarios, wording, selectors, and refactors, but the tester decides what matters, what is worth automating, and what result is credible enough to show.

In this project, AI is treated like a fast second brain, not an autopilot. It helps create options, but a human reviews the business value, confirms the website behavior, checks the evidence, and keeps the suite understandable for future maintainers.

The authored decisions are human-owned: suite taxonomy, page object boundaries, generated data strategy, business-report expectations, CI/CD acceptance gates, and the choice to keep flaky or product-relevant UI failures visible. AI may accelerate drafting, but the tester approves the architecture and evidence.

AI suggestions are accepted only after they are checked against the project architecture rules. The environment-resilience boundary is documented in [ADR 0001](adr/0001-environment-resilience-boundary.md) and enforced by lint for page objects and shared support helpers.

## How AI Helps

- Convert business flows into candidate E2E scenarios.
- Suggest page object boundaries.
- Review tests for readability and duplication.
- Draft documentation and coverage summaries.
- Identify flaky patterns such as arbitrary waits or overly broad selectors.

## Example Prompts

```text
Review this Playwright test for maintainability, locator quality, and flakiness risk.
```

```text
Turn these ecommerce user journeys into a concise regression test matrix for recruiters and QA leads.
```

```text
Suggest a business-facing report structure for Playwright test results that highlights risk and release confidence.
```

## Human Review Checklist

- Does the test prove a meaningful user outcome?
- Would the failure message help diagnose the product risk?
- Are selectors stable enough for a public demo application?
- Is generated data unique and safe to rerun?
- Does the page object make the test simpler rather than hiding important intent?
- Does the business report match the raw Playwright result?

## CI/CD Validation

AI-assisted changes are accepted only after validation. The GitHub Actions quality gate runs typecheck, lint, unit/reporting tests, coverage freshness, accessibility scans, and the focused `@smoke|@session` Playwright gate on pushes and pull requests to `main`.

The full 210 browser-scenario regression suite runs separately on pushes to `main`, a weekly schedule, and manual dispatch. That split keeps pull-request feedback focused while preserving complete regression evidence for the public dashboard.

The business report is also part of the evidence loop. It helps confirm that the automated result can be explained in business language, not only as a raw technical pass or failure.

## Guardrails

- Do not paste AI code without running it.
- Do not trust invented selectors.
- Do not inflate coverage claims beyond automated evidence.
- Do not hide flaky behavior behind excessive retries.
- Do not add raw navigation or reload recovery outside the approved app-navigation boundary.
- Keep the final repository understandable to humans first.
