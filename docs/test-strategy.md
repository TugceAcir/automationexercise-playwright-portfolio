# Test Strategy

## Objective

Prove that high-value ecommerce journeys on Automation Exercise can be automated with maintainable Playwright TypeScript code and business-readable reporting.

## Scope

The first portfolio version covers UI E2E flows only. API tests are intentionally left out so the repository can stay focused and stable.

## Design Principles

- Write tests in business language and hide UI mechanics in page objects.
- Generate unique user data for account and checkout flows.
- Keep browser execution headless by default.
- Capture traces, screenshots, and videos only when they add debugging value.
- Prefer accessible locators and stable app attributes; use scoped CSS selectors when the demo site has limited accessibility metadata.
- Clean up created accounts during the test flow where supported by the application.

## Risk Management

The target is a public demo website, so network latency, third-party consent surfaces, and occasional availability issues can affect stability. The framework mitigates this with retries in CI, explicit waits through Playwright assertions, isolated browser contexts, and diagnostic artifacts.

## Reporting Strategy

The Playwright HTML report is the technical source of truth. The custom business report is the stakeholder layer, summarizing confidence, feature risk, scenario status, and trend data after every run.
