# Project Memory

This file is the quick handoff note for future work in this repo. Read it before scanning every spec again.

## Snapshot

- Target app: https://automationexercise.com/
- Stack: Playwright Test, TypeScript, page objects, generated test users, custom business report.
- Main goal: UI E2E coverage first, then API testing.
- Current suite size after duplicate cleanup: 70 tests.
- Last verified on 2026-06-15: `npx playwright test` passed 70/70.
- CI/CD: GitHub Actions validates typecheck, lint, and Playwright tests; successful pushes to `main` publish `business-report/` to GitHub Pages.
- GitHub repo: https://github.com/TugceAcir/automationexercise-playwright-portfolio
- GitHub Pages report URL: https://tugceacir.github.io/automationexercise-playwright-portfolio/

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

## Commands

```bash
npm test
npm run test:smoke
npm run test:regression
npm run typecheck
npm run lint
npx playwright test tests/e2e/cart.spec.ts
```

## GitHub Setup

- Repository exists at `TugceAcir/automationexercise-playwright-portfolio`.
- Local `main` tracks `origin/main`.
- Workflow file: `.github/workflows/playwright.yml`.
- Pages source should be set to GitHub Actions in repository settings.
- If private GitHub Pages is not available on the account, use uploaded workflow artifacts until the repo can be public or Pages is available.

## Stability Decisions

- `BasePage.goto()` uses `waitUntil: 'domcontentloaded'` to reduce timeout noise on the public demo site.
- Playwright runs with 2 workers to balance speed and public-site stability.
- Tests block noisy third-party ad domains only in flows that create restored browser contexts.
- Generated test users avoid collisions in account and checkout flows.

## Coverage Policy

- Keep one strong test for each behavior.
- Keep session tests when app state matters, such as auth, cart, and checkout.
- Prefer refresh and browser-back tests for stateless pages; remove tab-close/context-restart checks that only prove a page can be opened again.
- Negative and edge tests should prove real validation or boundary behavior, not repeat the same happy path with a different label.

## Next Work

- Add API tests after UI suites are stable.
- Criticize and improve selectors, data cleanup, and test tagging after the full suite is green.
- Keep this file updated when suite purpose, commands, or stability decisions change.
