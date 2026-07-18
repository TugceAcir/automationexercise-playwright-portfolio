# Agent Handoff

This repo is a Playwright + TypeScript UI automation portfolio for Automation Exercise. Read this file before changing tests, page objects, reports, or documentation.

## Project Priorities

- Keep the suite explainable to recruiters and QA leads, not only runnable.
- Preserve business-readable test names and tags.
- Prefer reliability and evidence over raw test count.
- Keep API testing as post-public expansion so the initial public release stays focused and defensible.

## Architecture Rules

- Page objects in `pages/` model page behavior and stable UI interactions.
- Specs in `tests/e2e/` describe business scenarios and assertions.
- Shared cross-flow actions live in `tests/support/test-actions.ts`.
- Fixtures in `fixtures/pages.fixture.ts` provide reusable page objects and automatic setup.
- Test data factories in `test-data/` generate unique, rerunnable data.
- The business report entry point is `scripts/business-reporter.ts`; report engine code lives under `scripts/business-report/`.
- Accessibility specs run through `playwright.a11y.config.ts`; their reporter writes a separate summary consumed by the business dashboard without changing functional coverage totals.

## Suite Map

| Suite | Purpose | Notes |
| --- | --- | --- |
| `auth.spec.ts` | Registration, login, logout, duplicate signup, validation, logged-in navigation state | Account cleanup is part of the tests that create users. |
| `home.spec.ts` | Home smoke, subscription, product discovery sections, scroll behavior, refresh/back behavior | Stateless tab-close/context-restart checks were removed as low value. |
| `products.spec.ts` | Product list, detail, search, brand switching, reviews, invalid detail routes, refresh/back behavior | Single-brand filter test was removed because brand switching covers it. |
| `category.spec.ts` | Category browsing and invalid category route | Small focused suite. |
| `cart.spec.ts` | Add/remove products, quantity, totals, subscription, cart after login, recommended items, cart persistence | Browser-context restore remains because cart state matters. |
| `checkout.spec.ts` | Registered and guest checkout flows, register/login during checkout, payment validation, addresses, invoice, checkout persistence | Browser-context restore remains because checkout state matters. |
| `contact.spec.ts` | Contact form with and without attachment, validation, long message, refresh behavior | Browser-history draft restoration and stateless context checks were removed as low value. |
| `navigation.spec.ts` | Static navigation targets and external tutorial link | Good place for top-level links that do not belong to feature suites. |
| `accessibility.spec.ts` | WCAG 2.1 A/AA regression scans for five representative page states | Chromium-only, informational CI with state-and-rule fingerprint baselines; excluded from the 70/210 functional totals. |

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
- Keep transient demo-site recovery inside `pages/app-navigation.ts`; this boundary is documented in `docs/adr/0001-environment-resilience-boundary.md` and enforced by ESLint for page objects and support helpers.
- Use conservative workers by default because the target is a public demo site.
- Keep third-party route blocking narrow and intentional.
- When a test fails, classify it before fixing it: product, test, environment, or data.

## Validation

For docs-only changes, run `git diff --check` and review links.

For code or test changes, run:

```bash
npm run typecheck
npm run lint
npm run test:a11y
npm run test:cross-platform
npm run business-report
```

Use `npm run triage:failures` after failed Playwright runs to summarize failure evidence and separate likely public-demo environment failures from failures needing review. Run the full 210 browser-scenario suite for shared helper, page object, workflow, or release-evidence changes.

## Status

Keep this section current whenever the suite size, verified run, or next steps change.

- Target app: https://automationexercise.com/ (public demo site).
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
- Last fully green verified run remains 2026-07-02: `npx playwright test` produced 210/210 passed browser-scenario executions in 44.9m, with no skipped or flaky results. New failed runs should be recorded with `npm run triage:failures` classification rather than treated as equivalent framework regressions.
- Successful full-regression runs on `main` publish `business-report/` to GitHub Pages.
- Pushes and pull requests run the focused Ubuntu `@smoke|@session` gate with retries; full 210 browser-scenario regression runs on `main`, schedule, and manual dispatch.
- A weekly or manually dispatched compatibility workflow runs `@smoke|@session` on Windows and macOS with environment metadata recorded in the job log.
- Five Chromium accessibility scans use stable `A11Y001`-`A11Y005` IDs and publish their informational WCAG 2.1 A/AA baseline status in the business dashboard.

### Next Work

- Keep CI, Pages, reviewer links, and `main` branch protection working before expanding scope.
- Add API coverage and consolidate remaining scenario-specific selectors through focused pull requests.
- Use `npm run triage:failures` as the evidence source for future issue creation integrations.
