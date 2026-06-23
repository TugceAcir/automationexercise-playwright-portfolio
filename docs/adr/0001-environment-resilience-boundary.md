# ADR 0001: Environment Resilience Boundary

## Status

Accepted

## Context

Automation Exercise is a public demo site. It can occasionally return transient server or load pages such as 500, 520, queue-full, or blank responses. The suite still needs to stay honest: a healthy page that does not show the expected user outcome is a product, test, environment, or data signal to triage, not something to hide with reloads.

## Decision

Only `pages/app-navigation.ts` may detect and recover from confirmed transient demo-site failures.

Page objects model user behavior and assertions. They must not re-route, reload, or retry because a healthy page is missing an expected element. Shared support helpers follow the same rule, except for clearly labeled cleanup-only recovery.

The rule is enforced by ESLint for `pages/` and `tests/support/`. Specs may still use explicit navigation for scenarios that intentionally prove invalid routes or browser session behavior.

## Consequences

- Meaningful UI failures remain visible.
- Demo-site instability is handled in one place.
- Local retries can stay honest without removing CI diagnostic retries.
- Future changes cannot quietly add page-object self-healing through raw `page.goto` or `page.reload`.
