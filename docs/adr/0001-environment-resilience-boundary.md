# ADR 0001: Environment Resilience Boundary

## Status

Accepted

## Context

Automation Exercise is a public demo site. It can occasionally return transient server or load pages such as 500, 520, queue-full, or blank responses. The suite still needs to stay honest: a healthy page that does not show the expected user outcome is a product, test, environment, or data signal to triage, not something to hide with reloads.

## Decision

Only `pages/app-navigation.ts` may detect and recover from confirmed transient demo-site failures.

Action retries must also be safe. Idempotent navigation and login may be repeated after a confirmed transient error page or navigation timeout. Signup, account creation, and payment submission are never repeated once their application request has been answered, whatever the answer, because an error response does not prove that the server rejected the operation.

`actAndConfirmDemoRequest` may repeat a user action once when its outcome is uncommitted: Playwright saw no matching application request inside the wait window, or saw the request but it was never answered (aborted by a navigation, or lost on the network). Before that one repeat it runs the call site's `isCommitted` proof, a check of the page the action leads to, such as the order confirmation after payment or `/account_created` after account creation, and repeats nothing when that proof holds. A proof that is missing or throws counts as not proven. Every call site where a replay would be harmful (signup, account creation, payment, proceeding to checkout, cart additions) supplies one.

Why the unanswered request takes this path: it used to be treated as success, which reported writes that never landed as passed steps. The `isCommitted` proofs were added in the same change (#36, 2026-09-09) so that the retry this opened cannot double-submit an action that did land. The remaining limit is deliberate and should stay visible: "not proven committed" is not "proven not committed". The repeat presses the same control, so it can happen only while that control is still on the page, meaning the browser never reached the page the action leads to; a server that handled the lost request without the page moving on would see it twice.

Cart additions with the same product and quantity may also repeat after a confirmed 5xx response because that endpoint sets the requested cart state idempotently. Payment deliberately does not: a 5xx is an answer the server owns, and replaying it would submit a second payment.

A state-changing action whose outcome can be proven afterwards from a fresh, healthy page is never replayed blind after a transient error page. `actAndVerifyOutcome` establishes the outcome first and repeats the action only when that proof shows it did not land; an outcome that cannot be proven either way fails as an environment failure. Logout is proven by the session header, which shows "Signup / Login" only to a logged-out visitor. Account deletion is proven by the account's own credentials, because the demo site renders its "Account Deleted!" page to logged-out visitors too, so that page proves nothing (verified 2026-09-19). Both needed this after run `35213250293`: a logout that landed was replayed against a page with no Logout link left, and a deletion answered by a queue-full page was reported as a missing element rather than as the environment failure it was.

Page objects model user behavior and assertions. They must not re-route, reload, or retry because a healthy page is missing an expected element. Shared support helpers follow the same rule, except for clearly labeled cleanup-only recovery.

Account cleanup may use the generated customer's credentials to restore an expired authenticated session. A confirmed invalid login means the account does not exist; other cleanup failures remain visible.

The rule is enforced by ESLint for `pages/` and `tests/support/`. Specs may still use explicit navigation for scenarios that intentionally prove invalid routes or browser session behavior.

## Consequences

- Meaningful UI failures remain visible.
- Demo-site instability is handled in one place.
- Local retries can stay honest without removing CI diagnostic retries.
- Future changes cannot quietly add page-object self-healing through raw `page.goto` or `page.reload`.
