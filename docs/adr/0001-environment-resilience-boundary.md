# ADR 0001: Environment Resilience Boundary

## Status

Accepted

## Context

Automation Exercise is a public demo site. It can occasionally return transient server or load pages such as 500, 520, queue-full, or blank responses. The suite still needs to stay honest: a healthy page that does not show the expected user outcome is a product, test, environment, or data signal to triage, not something to hide with reloads.

## Decision

Only `pages/app-navigation.ts` may detect and recover from confirmed transient demo-site failures.

Action retries must also be safe. Idempotent navigation and login may be repeated after a confirmed transient error page or navigation timeout. Signup, account creation, and payment submission remain single-attempt after their application request is emitted because a failed response does not prove that the server rejected the operation.

A user action may be repeated once when Playwright observes that it emitted no matching application request. This is an uncommitted action, not a failed server operation. Cart additions with the same product and quantity may also repeat after a confirmed 5xx response because that endpoint sets the requested cart state idempotently. Once signup, account creation, or payment emits a request, it is never repeated automatically.

Page objects model user behavior and assertions. They must not re-route, reload, or retry because a healthy page is missing an expected element. Shared support helpers follow the same rule, except for clearly labeled cleanup-only recovery.

Account cleanup may use the generated customer's credentials to restore an expired authenticated session. A confirmed invalid login means the account does not exist; other cleanup failures remain visible.

The rule is enforced by ESLint for `pages/` and `tests/support/`. Specs may still use explicit navigation for scenarios that intentionally prove invalid routes or browser session behavior.

## Consequences

- Meaningful UI failures remain visible.
- Demo-site instability is handled in one place.
- Local retries can stay honest without removing CI diagnostic retries.
- Future changes cannot quietly add page-object self-healing through raw `page.goto` or `page.reload`.
