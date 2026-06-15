# AI-Assisted Testing Workflow

## Positioning

AI is used as a senior assistant for speed, structure, and review. It does not replace test judgment. Every generated idea, locator, assertion, and abstraction is validated against the running application.

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

## Guardrails

- Do not paste AI code without running it.
- Do not trust invented selectors.
- Do not inflate coverage claims beyond automated evidence.
- Do not hide flaky behavior behind excessive retries.
- Keep the final repository understandable to humans first.
