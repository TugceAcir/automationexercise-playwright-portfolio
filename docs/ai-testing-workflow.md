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

AI-assisted changes are accepted only after validation. The GitHub Actions quality gate runs typecheck, lint, unit/reporting tests, coverage freshness, accessibility scans, and the focused `@smoke|@session` Playwright gate on pull requests to `main`.

The full 210 browser-scenario regression suite runs separately on pushes to `main`, a weekly schedule, and manual dispatch. Live-site workflows are serialized through one concurrency group so automation evidence does not create avoidable load on the public demo site.

The business report is also part of the evidence loop. It helps confirm that the automated result can be explained in business language, not only as a raw technical pass or failure.

## Guardrails

- Do not paste AI code without running it.
- Do not trust invented selectors.
- Do not inflate coverage claims beyond automated evidence.
- Do not hide flaky behavior behind excessive retries.
- Do not add raw navigation or reload recovery outside the approved app-navigation boundary.
- Keep the final repository understandable to humans first.

### Worked Example: Classify Before Fixing

The guardrails above are easy to agree with and easy to skip under time pressure. This is a real case from this repository where skipping them would have produced a fix that fixed nothing.

`@AUTH004` (`signup blocks an email that already exists`) failed intermittently on Firefox in CI. The proposed fix was to raise the timeout in `LoginPage.expectExistingEmailMessage()` from 10 seconds to 60, on the theory that the signup POST was slow on Firefox and the duplicate-email message had not rendered yet.

I ran the scenario locally with `--trace on` before changing anything. The assertion resolved in **34 ms** — the existing 10-second timeout was already about 300x more than it needed. So when this test fails in CI, the message is not slow, it is **absent**. Raising the timeout would have changed nothing except adding 50 seconds to every failure, while looking like a fix and closing the investigation.

That ruled out a test-timing defect, and my next theory was **data**: the duplicate-email precondition not holding, so the second signup was genuinely not a duplicate. If that were true, the page would proceed to the account-information form.

**The next failure disproved that theory too.** The scenario failed again on Firefox, and this time I had the trace. Two facts settled it:

- The original account creation succeeded — `POST /signup`, then `GET /account_created`. The precondition held. The duplicate really was a duplicate.
- The duplicate attempt **never emitted a second `POST /signup` at all**. The page snapshot at failure shows the browser still on the login form, fields still populated, no error message and no account-information form. The submission simply never happened.

So the problem is not the assertion, and not the data. It is that a click can produce no submission and the page object accepts that silently: `LoginPage.startSignup()` clicks, then waits only *if* navigation occurs. Four lines below it in the same file, `completeAccountInformation()` already does the right thing — it wraps its click in a helper that confirms the expected request was actually sent.

**Planned response, not yet implemented:** apply that same confirmation to `startSignup()`, so a submission that never happens is detected and retried instead of silently accepted. The remaining open question is *why* Firefox occasionally produces no request on that render. That question does not block the fix, because the suite should detect and recover from a missing submission regardless of the cause.

Three things I took from it:

- Two plausible theories, both disproven by evidence. Each survived review; neither survived a trace.
- **Narrowing is progress.** This is not solved yet. Recording where the investigation actually stands is more useful than a tidy conclusion I would have to retract.
- **Collect the evidence while it exists.** Playwright traces ship inside the run's report artifact, which every workflow pins to `retention-days: 3`. Raising the repository-level retention does not extend them — that setting is a cap, not a floor, and applies to logs. After three days the trace is gone and the investigation restarts from zero.

I keep both disproven theories on record so they do not get proposed a third time.
