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

## Suite Map

| Suite | Purpose | Notes |
| --- | --- | --- |
| `auth.spec.ts` | Registration, login, logout, duplicate signup, validation, logged-in navigation state | Account cleanup is part of the tests that create users. |
| `home.spec.ts` | Home smoke, subscription, product discovery sections, scroll behavior, refresh/back behavior | Stateless tab-close/context-restart checks were removed as low value. |
| `products.spec.ts` | Product list, detail, search, brand switching, reviews, invalid detail routes, refresh/back behavior | Single-brand filter test was removed because brand switching covers it. |
| `category.spec.ts` | Category browsing and invalid category route | Small focused suite. |
| `cart.spec.ts` | Add/remove products, quantity, totals, subscription, cart after login, recommended items, cart persistence | Browser-context restore remains because cart state matters. |
| `checkout.spec.ts` | Registered and guest checkout flows, register/login during checkout, payment validation, addresses, invoice, checkout persistence | Browser-context restore remains because checkout state matters. |
| `contact.spec.ts` | Contact form with and without attachment, validation, long message, refresh/back behavior | Stateless tab-close/context-restart checks were removed as low value. |
| `navigation.spec.ts` | Static navigation targets and external tutorial link | Good place for top-level links that do not belong to feature suites. |

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
npx playwright test
npm run business-report
```

Use `npm run triage:failures` after failed Playwright runs to summarize failure evidence.

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
- Last verified on 2026-06-16: `npx playwright test` passed 70/70.
- Successful pushes to `main` publish `business-report/` to GitHub Pages.

### Next Work

- Add API tests after UI suites are stable.
- Use `npm run triage:failures` as the source for future Jira MCP or Jira REST ticket creation.
