# Agent Handoff

This repo is a Playwright + TypeScript UI automation portfolio for Automation Exercise. Read this file before changing tests, page objects, reports, or documentation.

## Project Priorities

- Keep the suite explainable to recruiters and QA leads, not only runnable.
- Preserve business-readable test names and tags.
- Prefer reliability and evidence over raw test count.
- Do not add API testing until the UI framework and docs stay stable.

## Architecture Rules

- Page objects in `pages/` model page behavior and stable UI interactions.
- Specs in `tests/e2e/` describe business scenarios and assertions.
- Shared cross-flow actions live in `tests/support/test-actions.ts`.
- Fixtures in `fixtures/pages.fixture.ts` provide reusable page objects and automatic setup.
- Test data factories in `test-data/` generate unique, rerunnable data.
- The business report entry point is `scripts/business-reporter.ts`; report engine code lives under `scripts/business-report/`.

## Extending Tests

Use this workflow for new or changed UI E2E coverage:

1. Identify the business behavior and risk.
2. Add or update a page object method for page-specific behavior.
3. Add shared orchestration to `tests/support/test-actions.ts` only when multiple suites need it.
4. Add the spec under the matching business suite in `tests/e2e/`.
5. Tag it with `@smoke`, `@regression`, `@negative`, `@edge`, or `@session`.
6. Run the focused spec first.
7. Run full validation when shared helpers, page objects, or config changed.

Page objects should answer: "What can a user do on this page?" Keep multi-page journeys, generated data, and cleanup decisions in support helpers or specs.

## Locator Rules

Use the most stable, readable locator available:

1. Accessible role/name locators for user-facing controls.
2. Stable app attributes such as `data-qa` when available.
3. Scoped CSS selectors when the public demo site lacks accessibility metadata.

Avoid brittle full-page CSS chains, positional selectors without a business reason, and invented selectors that were not verified against the running page.

## Reliability Rules

- Prefer Playwright locator auto-waiting and assertions.
- Do not hide meaningful UI failures behind direct route fallbacks.
- Use conservative workers by default because the target is a public demo site.
- Keep third-party route blocking narrow and intentional.
- When a test fails, classify it before fixing it: product, test, environment, or data.

## Validation

For docs-only changes, run `git diff --check` and review links.

For code or test changes, run:

```bash
npm run typecheck
npm run lint
npx playwright test
npm run business-report
```

Use `npm run triage:failures` after failed Playwright runs to summarize failure evidence.
