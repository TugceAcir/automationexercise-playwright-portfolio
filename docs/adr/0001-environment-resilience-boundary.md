# ADR 0001: Environment Resilience Boundary

## Status

Accepted

## Context

Automation Exercise is a public demo site. It can occasionally return transient server or load pages such as 500, 520, queue-full, or blank responses. The suite still needs to stay honest: a healthy page that does not show the expected user outcome is a product, test, environment, or data signal to triage, not something to hide with reloads.

## Decision

Only `pages/app-navigation.ts` may detect and recover from confirmed transient demo-site failures.

Action retries must also be safe. Idempotent navigation and login may be repeated after a confirmed transient error page or navigation timeout. Signup, account creation, and payment submission remain single-attempt after their application request is emitted because a failed response does not prove that the server rejected the operation.

A user action may be repeated once when Playwright observes that it emitted no matching application request. This is an uncommitted action, not a failed server operation. Cart additions with the same product and quantity may also repeat after a confirmed 5xx response because that endpoint sets the requested cart state idempotently. Once signup, account creation, or payment emits a request, it is never repeated automatically.

A state-changing action whose outcome can be proven afterwards from a fresh, healthy page is never replayed blind after a transient error page. `actAndVerifyOutcome` establishes the outcome first and repeats the action only when that proof shows it did not land; an outcome that cannot be proven either way fails as an environment failure. Logout is proven by the session header, which shows "Signup / Login" only to a logged-out visitor. Account deletion is proven by the account's own credentials, because the demo site renders its "Account Deleted!" page to logged-out visitors too, so that page proves nothing (verified 2026-09-19). Both needed this after run `35213250293`: a logout that landed was replayed against a page with no Logout link left, and a deletion answered by a queue-full page was reported as a missing element rather than as the environment failure it was.

Page objects model user behavior and assertions. They must not re-route, reload, or retry because a healthy page is missing an expected element. Shared support helpers follow the same rule, except for clearly labeled cleanup-only recovery.

Account cleanup may use the generated customer's credentials to restore an expired authenticated session. A confirmed invalid login means the account does not exist; other cleanup failures remain visible.

The rule is enforced by ESLint for `pages/` and `tests/support/`. Specs may still use explicit navigation for scenarios that intentionally prove invalid routes or browser session behavior.

## Consequences

- Meaningful UI failures remain visible.
- Demo-site instability is handled in one place.
- Local retries can stay honest without removing CI diagnostic retries.
- Future changes cannot quietly add page-object self-healing through raw `page.goto` or `page.reload`.
