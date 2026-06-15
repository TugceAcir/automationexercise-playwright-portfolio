# Automation Exercise Playwright Portfolio

This repository is a senior-style UI test automation portfolio for [Automation Exercise](https://automationexercise.com/). It uses Playwright, TypeScript, page objects, generated test data, CI execution, technical reports, and a custom business dashboard that refreshes after every test run.

## Why This Project Stands Out

- Tests run headlessly by default for CI-ready execution.
- Page objects keep tests readable and business-focused.
- Generated users avoid shared credentials and reduce data collisions.
- Playwright traces, screenshots, videos, and HTML reports support technical debugging.
- A custom business report translates raw automation results into release confidence, feature risk, and scenario evidence.
- Documentation explains how AI was used as an accelerator while keeping human review in control.

## Tech Stack

- Playwright Test
- TypeScript
- ESLint
- GitHub Actions
- GitHub Pages
- Custom HTML business reporter

## Getting Started

```bash
npm install
npx playwright install chromium
npm test
```

The default test command runs the full UI E2E suite in headless Chromium and refreshes:

```text
business-report/index.html
```

## Useful Commands

```bash
npm test                 # Run all tests headlessly and refresh the business report
npm run test:smoke       # Run smoke tests only
npm run test:regression  # Run regression tests only
npm run test:headed      # Debug in headed browser mode
npm run test:ui          # Use Playwright UI mode
npm run report           # Open Playwright technical HTML report
npm run business-report  # Regenerate the business dashboard from latest JSON results
npm run typecheck        # Validate TypeScript
npm run lint             # Validate code style
```

## Coverage

Current UI E2E suite size: 70 tests.

| Business Area | Automated Scenarios |
| --- | --- |
| Home Experience | Home smoke, subscription validation, product discovery sections, scroll controls, refresh and browser-back behavior |
| Authentication | Register, delete account, login/logout, duplicate signup, form validation, name edge case, logged-in refresh and browser-back behavior |
| Product Discovery | Product listing, product detail, search, no-result search, partial search, brand switching, reviews, invalid product routes |
| Categories | Women, men, and kids category browsing plus invalid category routes |
| Cart | Add/remove products, selected quantity, empty cart, duplicate product quantity, totals, subscription, recommended items, cart after login, cart persistence |
| Support | Contact form with and without file upload, email validation, long message, refresh and browser-back behavior |
| Checkout | Registered checkout, guest checkout prompt, register/login during checkout, payment validation, address verification, invoice download, checkout persistence |
| Navigation | Test Cases page, API Testing page, external tutorial link |

The suite intentionally keeps one strong version of each behavior. Low-value duplicates, such as repeated tab-close checks on stateless public pages, are removed so the suite stays easier to explain and maintain.

## Reporting

After each run, Playwright creates two report layers:

- `playwright-report/`: technical report with traces and failure evidence.
- `business-report/index.html`: portfolio-facing dashboard for recruiters and QA leads.

The business report includes confidence score, feature coverage, failed scenario risk, duration, attempts, and a local confidence trend from `business-report/history.json`.

## CI/CD

GitHub Actions runs the suite in headless Chromium on pushes and pull requests to `main`.

The pipeline validates:

- TypeScript compilation
- ESLint rules
- Playwright UI E2E tests

Every run uploads Playwright reports, the business report, and raw test results as workflow artifacts. Successful pushes to `main` also publish `business-report/` to GitHub Pages so the portfolio dashboard can be opened from the repository's Pages URL.

After the repository is pushed to GitHub, add the workflow badge and GitHub Pages link here using the final repository URL.

## AI-Assisted Testing

See [docs/ai-testing-workflow.md](docs/ai-testing-workflow.md) for the workflow used to turn AI assistance into reviewed, maintainable automation instead of blind code generation.

## Project Tracking

See [docs/project-memory.md](docs/project-memory.md) for the current suite map, stability decisions, useful commands, and next testing priorities.
