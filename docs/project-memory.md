# Project Memory

Current-state snapshot for quick orientation. Architecture and extension rules live in `AGENTS.md`.

## Snapshot

- Target app: https://automationexercise.com/
- Stack: Playwright Test, TypeScript, page objects, generated test users, custom business report.
- Main goal: UI E2E coverage first, then API testing.
- Last verified suite size after duplicate cleanup: 70 tests.
- Last verified on 2026-06-16: `npx playwright test` passed 70/70.
- CI/CD: GitHub Actions validates typecheck, lint, and Playwright tests; successful pushes to `main` publish `business-report/` to GitHub Pages.
- GitHub repo: https://github.com/TugceAcir/automationexercise-playwright-portfolio
- GitHub Pages report URL: https://tugceacir.github.io/automationexercise-playwright-portfolio/
- Config: dependencies are pinned, `BASE_URL` can override the target app, and default workers stay conservative for the public demo site.

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

## Next Work

- Add API tests after UI suites are stable.
- Use `npm run triage:failures` as the source for future Jira MCP or Jira REST ticket creation.
- Keep this file updated when the suite map, verified run, or active next steps change.
