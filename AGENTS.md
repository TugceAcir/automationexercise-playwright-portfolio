# Agent Handoff

> These rules are owned and reviewed by [Tugce Acir](https://github.com/TugceAcir). Every constraint in this file was reviewed and accepted by a human tester before it was written down, and the ones that matter most are enforced mechanically rather than by convention — the architecture boundary in [ADR 0001](docs/adr/0001-environment-resilience-boundary.md) is enforced by the ESLint rule in `eslint.config.mjs`, and the coverage counts below are generated and verified by `npm run coverage:check`.

This repo is a Playwright + TypeScript UI automation portfolio for Automation Exercise. Read this file before changing tests, page objects, reports, or documentation.

## Project Priorities

- Keep the suite explainable to recruiters and QA leads, not only runnable.
- Preserve business-readable test names and tags.
- Prefer reliability and evidence over raw test count.
- Keep API testing isolated in `api-contract/`. Only the read suite runs automatically. Account-changing endpoints live in the manual-only lifecycle suite and touch nothing but accounts the package generated itself; widening that blast radius - a fixed account, anyone else's data, or an automatic trigger - needs its own approved plan before any code.

## Progress Tracking

Use the local-only `progress.md` file to make interrupted work resumable.

- At the start of every new task or continuation, read `progress.md` if it exists.
- Before doing task work, write the goal, plan, branch/repo state, and expected validation to `progress.md`.
- Update `progress.md` after meaningful milestones, edits, command results, failed commands, CI/PR events, blockers, approvals, and user decisions.
- Before stopping, record the current state, last successful command, last failed command when applicable, and the exact next command.
- Keep the newest/current job at the top and remove old completed jobs when they stop being useful.
- Do not commit `progress.md`; it is ignored by Git and is only for local handoff state.

## Documentation Ownership

Each document owns one job. Claims drift when the same fact is restated in several places and only some copies get updated, so state a fact where it is owned and link to it from everywhere else rather than repeating it.

| Document | Owns | Should not carry |
| --- | --- | --- |
| `README.md` | Reviewer path, project value, generated coverage snapshot, live evidence links, intentional scope | Detailed CI mechanics, the scoring formula, repeated AI positioning, static "latest run" prose |
| `AGENTS.md` | Agent rules, architecture constraints, generated coverage snapshot, the current verified-run citation, dated historical milestones | Recruiter-facing narrative duplicated from the README |
| `docs/test-strategy.md` | Scope, risk matrix, taxonomy, test-selection rationale, limitations | Volatile scenario totals, and any claim not backed by a scenario that exists |
| `docs/ai-testing-workflow.md` | Human ownership of QA decisions, and one corrected real case study | Repeated portfolio sales language |
| `docs/adr/` | The environment-resilience boundary only | General strategy or run-status material |

Two rules follow from this:

- **Counts are generated, never typed.** Two generators each own one pair of blocks in `README.md` and `AGENTS.md`, and neither touches the other's. The UI blocks (`<!-- coverage:... -->`, 69/207 style) are written by the root `npm run coverage:counts` and verified by the root `npm run coverage:check`. The API blocks (`<!-- api-coverage:... -->`) are written by `npm run coverage:counts` inside `api-contract/` and verified by its `npm run coverage:check`, which counts from Playwright's `--list` because one API spec declares its tests in a loop. Do not hand-edit a scenario or execution total anywhere; if a number needs changing, the suite changed and the generator should produce it.
- **A number in prose needs a date.** Any figure that is not generated — a cited run, a screenshot's contents, a historical milestone — carries the date and commit it describes, so a reader can tell current evidence from a past state.

## Architecture Rules

- Page objects in `pages/` model page behavior and stable UI interactions.
- Specs in `tests/e2e/` describe business scenarios and assertions.
- Shared cross-flow actions live in `tests/support/test-actions.ts`.
- Fixtures in `fixtures/pages.fixture.ts` provide reusable page objects and automatic setup.
  - Specs use the fixture-injected page objects. Do not construct one by hand against the default `page` - the two forms are equivalent only while every fixture stays pure construction, so a hand-built instance would silently skip any setup a fixture later gains.
  - Shared helpers in `tests/support/` construct page objects manually, because a plain helper taking `page` has no fixture scope.
  - A separate `BrowserContext` also constructs manually: fixtures bind to the default `page`, so a restored or second page cannot be served by them.
- Test data factories in `test-data/` generate unique, rerunnable data.
- The business report entry point is `scripts/business-reporter.ts`; report engine code lives under `scripts/business-report/`.
- Accessibility specs run through `playwright.a11y.config.ts`; their reporter writes a separate summary consumed by the business dashboard without changing functional coverage totals.
- Dashboard publishing is gated by the `PUBLISH_DASHBOARD` repository variable. Set it to `true` only when the repo is public and Pages is enabled. While unset, full-regression runs stay green and skip publishing.
- `api-contract/` is an isolated API contract package with its own dependencies, config, reports and workflow (`.github/workflows/api-contract.yml`). The generated UI coverage figures below exclude it. UI code never imports from it, and its runtime never imports from the UI side; the only reads across are two test-only ones, the classifier parity test and (planned) the product-data cross-check. Inside it, only `src/transport.ts` may send a request - it parses the body regardless of `Content-Type`, classifies environment versus contract failures, and retries once only a read marked retry-safe - and its ESLint config enforces that, as the root config enforces ADR 0001. Writes go through the transport's separate `sendWrite`, which never repeats a request and returns an explicit uncertain result when the answer is lost; `src/write-proof.ts` then proves the state with a read, never replays a create, and repeats an update or delete at most once, only after a read proves it did not land - the API counterpart of `actAndVerifyOutcome`. Tests live in two suites that never mix: `read` (`tests/api/`, every title tagged `@read`) and `lifecycle` (`tests/lifecycle/`, `@write`), selected by `npm run test:api` and `npm run test:lifecycle`; the count check fails a test whose tag does not match its suite. Live API runs start only after a successful full regression on `main` and run the read suite only, in the shared demo-site concurrency group; pull requests get offline checks only. The lifecycle suite never runs automatically and is not reachable from `workflow_run`: it is a manual dispatch with `suite: lifecycle`, in that same concurrency group, because it is the one job that writes to the shared demo site. Every account it touches comes from `src/test-user.ts` and is written to `results/lifecycle/cleanup.json` *before* its create is sent, so an account created by a request whose answer was lost is still on record; teardown proves each one absent, and anything it cannot prove fails the run as an explicit leftover rather than passing quietly. `npm run cleanup:leftovers` is the manual recovery tool - never a CI step - which is a dry run unless given `--confirm` and refuses any address the package did not generate, since it derives each password from the address.

## Suite Map

| Suite | Purpose | Notes |
| --- | --- | --- |
| `auth.spec.ts` | Registration, login, logout, duplicate signup, validation, logged-in navigation state | Account cleanup is part of the tests that create users. |
| `home.spec.ts` | Home smoke, subscription, product discovery sections, scroll behavior, refresh/back behavior | Stateless tab-close/context-restart checks were removed as low value. |
| `products.spec.ts` | Product list, detail, search, brand switching, reviews, invalid detail routes, refresh/back behavior | Single-brand filter test was removed because brand switching covers it. |
| `category.spec.ts` | Category browsing and invalid category route | Small focused suite. |
| `cart.spec.ts` | Add/remove products, quantity, totals, subscription, cart after login, recommended items, cart persistence | Browser-context restore remains because cart state matters. |
| `checkout.spec.ts` | Registered and guest checkout flows, register/login during checkout, payment validation, addresses, invoice, checkout persistence | Browser-context restore remains because checkout state matters. |
| `contact.spec.ts` | Contact form with and without attachment, validation, long message | Browser-history draft restoration and stateless context checks were removed as low value. A page-refresh check went the same way: it asserted browser form-restore behavior the demo site does not own. |
| `navigation.spec.ts` | Static navigation targets and external tutorial link | Good place for top-level links that do not belong to feature suites. |
| `accessibility.spec.ts` | WCAG 2.1 A/AA regression scans for five representative page states | Chromium-only, informational CI with state-and-rule fingerprint baselines; excluded from the functional totals. |
| `api-contract/tests/api/*.spec.ts` | Read-only API contract: catalog, search, login check, account lookup, unsupported methods (`@API###`, `@read`) | Separate package, non-browser project, own counts; never in the UI totals or the dashboard. |
| `api-contract/tests/lifecycle/*.spec.ts` | Account lifecycle on generated accounts: create/lookup/login/update/delete, duplicate registration, wrong-password delete and update (`@API1##`, `@write`) | Manual dispatch only. Writes to the public demo site, so every account is registered before creation and proven deleted in teardown. Never in the UI totals or the dashboard. |

## Extending Tests

Use this workflow for new or changed UI E2E coverage:

1. Identify the business behavior and risk.
2. Add or update a page object method for page-specific behavior.
3. Add shared orchestration to `tests/support/test-actions.ts` only when multiple suites need it.
4. Add the spec under the matching business suite in `tests/e2e/`.
5. Tag it with `@smoke`, `@regression`, `@negative`, `@edge`, or `@session`.
6. Run the focused spec first.
7. Run full validation when shared helpers, page objects, or config changed.

Page objects should answer: "What can a user do on this page?" Keep multi-page journeys, generated data, and cleanup decisions in support helpers or specs.

## Locator Rules

Use the most stable, readable locator available:

1. Accessible role/name locators for user-facing controls.
2. Stable app attributes such as `data-qa` when available.
3. Scoped CSS selectors when the public demo site lacks accessibility metadata.

Avoid brittle full-page CSS chains, positional selectors without a business reason, and invented selectors that were not verified against the running page.

## Reliability Rules

- Prefer Playwright locator auto-waiting and assertions.
- Do not hide meaningful UI failures behind direct route fallbacks.
- Keep transient demo-site recovery inside `pages/app-navigation.ts`; this boundary is documented in `docs/adr/0001-environment-resilience-boundary.md` and enforced by ESLint for page objects and support helpers.
- Use conservative workers by default because the target is a public demo site.
- Keep third-party route blocking narrow and intentional.
- When a test fails, classify it before fixing it: product, test, environment, or data.

## Validation

For docs-only changes, run `git diff --check` and review links.

For code or test changes, run:

```bash
npm run typecheck
npm run lint
npm run coverage:check
npm run test:a11y
npm run test:cross-platform
npm run business-report
```

`coverage:check` is what keeps the generated coverage block below honest, and the CI quality gate runs it too - so adding or removing a scenario without regenerating the counts fails there rather than here.

For changes under `api-contract/`, or to the files its workflow watches, run its own gates from inside that folder:

```bash
cd api-contract
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run coverage:check
npm run test:api
```

The API workflow's offline pull-request job runs all of these except `test:api`, which sends live requests and so runs only after a successful full regression.

`npm run test:lifecycle` is deliberately not in that list. It creates and deletes real accounts on the public demo site, so it is run by hand - locally, or by dispatching the workflow with `suite: lifecycle` - and never as part of a routine gate. After any lifecycle run, check `results/lifecycle/cleanup.json` (or the job summary) for leftovers, and clear anything it reports with `npm run cleanup:leftovers -- --file results/lifecycle/cleanup.json --confirm`.

Use `npm run triage:failures` after failed Playwright runs to summarize failure evidence and separate likely public-demo environment failures from failures needing review. Run the full browser-scenario suite for shared helper, page object, workflow, or release-evidence changes.

## Status

Keep this section current whenever the suite size, verified run, or next steps change.

- Target app: https://automationexercise.com/ (public demo site).
<!-- coverage:start -->
Last generated UI E2E suite snapshot: 69 scenarios. Cross-browser execution runs those scenarios across 3 browser projects for 207 browser-scenario executions.

| Business Area | Tests |
| --- | ---: |
| Authentication | 9 |
| Cart | 13 |
| Categories | 4 |
| Checkout | 12 |
| Support | 6 |
| Home Experience | 10 |
| Navigation | 3 |
| Product Discovery | 12 |
<!-- coverage:end -->
- Last fully green verified run: 2026-09-20. Full-regression workflow run [`35519690519`](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/runs/35519690519) on commit `801e17d` produced 207/207 passed browser-scenario executions in 43.5m, with no failed, no skipped and no flaky results. The run log's suite summary line reads `207 passed (43.5m)` with no trailing clause, and the accessibility scans read `5 passed (58.1s)`; the published dashboard row for it (`2026-09-20T16:13:51.947Z`) records `total 207 | passed 207 | failed 0 | skipped 0 | flaky 0 | scope full-regression`, `confidenceScore 100`, with every scenario at `attempts: 1`. That 43.5m is about 8 minutes slower than recent clean runs and is duration, not instability: every scenario still passed first time. It came at the end of a heavy traffic day against the demo site, which is the same pressure that made the preceding attempt fail its preflight. Read that summary line rather than the run's conclusion: a run whose scenarios all recover on retry is reported flaky and still exits 0, so a green tick alone does not establish a clean run. The cited commit need not be `main`'s head, and normally will not be: recording a citation is itself a commit, so the act of writing one advances `main` past the commit it names. A citation names the commit whose run was verified, not the newest commit - do not "correct" it by pointing at a newer commit whose run has not been read.
- Preceding clean runs, for continuity: the previous citation, `35468199959` on `86baeb5` (2026-09-19), `207 passed (33.8m)` bare, dashboard row `2026-09-19T21:18:11.462Z`, 207/207 at `attempts: 1`; and between the two, `35505640823` on `aef3ca3` (2026-09-20), `207 passed (35.2m)` bare - the run that proved the account-lifecycle merge had not disturbed the UI suite. Earlier the same day, `35456690004` on `51d1d15`, `207 passed (35.5m)` bare (dashboard row `2026-09-19T17:37:39.820Z`), and `35460279472` on `073362e`, `207 passed (32.5m)` bare (dashboard row `2026-09-19T18:43:29.550Z`). Before those, `34518418681` on `ad041ed` (2026-09-10), whose suite summary line read `207 passed (36.4m)` with no trailing clause; before it, `34500863755` on `2d7cbef` and `34493695998` on `0883374`, both 207/207 bare on their published dashboard rows (`2026-09-10T15:46:36.387Z` and `2026-09-10T13:01:34.776Z`). Before them, `34476624874` on `5c211ee`, whose suite summary line read `207 passed (34.4m)` with no trailing clause, and earlier still `34471996711` on `4da3ad5`, also 207/207 bare. Those runs follow the documentation and boundary work in #41 and #42; the pair before them, `34371515757` on `a916b9f` and `34366572432` on `2e9c4c1`, were the first clean pair after the `@CART010` fix in #36.
<!-- api-coverage:start -->
Last generated API contract snapshot: 16 scenarios in two non-browser suites - 12 read-only, and 4 account-lifecycle scenarios that write only to generated accounts. These are not part of the UI browser-scenario totals.

| API Area | Tests |
| --- | ---: |
| Account Lifecycle | 4 |
| Account Lookup | 2 |
| Catalog | 2 |
| Login Check | 2 |
| Product Search | 3 |
| Unsupported Methods | 3 |
<!-- api-coverage:end -->
- API contract layer, verified 2026-09-20: the read suite's current citation is automatic run [`35522072185`](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/runs/35522072185) on `801e17d`, started by `workflow_run` after the clean full regression cited above. Its suite summary line reads `12 passed (3.7s)` with no trailing clause, its count step reads `API coverage counts checked: 16 scenarios.`, and its job summary records `| 12 | 0 | 0 | 0 |` with 0 environment, 0 contract and 0 needs-review failures. **Only the `Read-Only API Contract Suite` job appeared in it** - the `Account Lifecycle Suite (manual)` job did not run at all, while the count step still saw all 16 scenarios. That is the read/write split demonstrated in CI rather than asserted, and it has now held on two consecutive automatic runs (`35507338106` on `aef3ca3` was the first). The immediately preceding read citation was `35470019631` on `86baeb5`, `12 passed (3.1s)` bare - the first CI run of the Part A runner and per-suite results path.
- Preceding clean API runs, for continuity, when the read suite was 10 scenarios rather than 12: three consecutive automatic runs, each started by `workflow_run` after a clean full regression on `main`, read `10 passed` with no trailing clause and job summaries of 0 environment, 0 contract and 0 needs-review failures - [`35452355933`](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/runs/35452355933) on `72e9e4d` (3.8s), [`35455916506`](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/runs/35455916506) on `00f78fb` (3.8s) and [`35458697140`](https://github.com/TugceAcir/automationexercise-playwright-portfolio/actions/runs/35458697140) on `51d1d15` (3.1s). The UI runs they followed read `207 passed` in 34.9m, 34.5m and 35.5m. Do not quote `10 passed` as current: `@API011` and `@API012` took the read suite to 12 in #58. API results are informational and never enter the dashboard.
- Historical milestone, superseded: 2026-08-29, run `33246339547` on `fcb6a48`, 210/210 passed in 34.7m with no failed, skipped or flaky results. It is kept as a dated record only. The suite is no longer 210 executions - `@CONTACT006` was removed in #31, taking it to 69 scenarios / 207 executions - so that figure must not be quoted as current.
- Known flake history on `@CART010`: it was reported flaky on run `34272034285` (Firefox, 2026-09-08) and earlier on webkit. Root cause was an unconfirmed asynchronous `add_to_cart`, fixed in #36; the two runs above are the evidence it holds. Two other explanations - an auto-rotating carousel, and a recovery step suspected of abandoning the write - were measured and disproven, and are recorded in `docs/ai-testing-workflow.md` so they are not proposed again.
- Evidence retention: since #35, Playwright report and raw-result uploads run on `!cancelled()` rather than `failure()`, so a flaky run keeps its trace instead of discarding it. Confirmed empirically on the green quality-gate run `34470099157`, which uploaded `playwright-report`, `accessibility-results` and `test-results` at 3-day retention despite nothing having failed - the behaviour `README.md` describes, on a run that passed.
- Successful full-regression runs on `main` publish `business-report/` to GitHub Pages when the `PUBLISH_DASHBOARD` repository variable is `true`. Publishing is attempted on pushes to `main` and manual dispatch only, never on the schedule.
- Pushes and pull requests run the focused Ubuntu `@smoke|@session` gate with retries; full browser-scenario regression runs on `main`, schedule, and manual dispatch.
- A weekly or manually dispatched compatibility workflow runs `@smoke|@session` on Windows and macOS with environment metadata recorded in the job log.
- Five Chromium accessibility scans use stable `A11Y001`-`A11Y005` IDs and publish their informational WCAG 2.1 A/AA baseline status in the business dashboard.

### Next Work

- Keep CI, Pages, reviewer links, and `main` branch protection working before expanding scope.
- Finish guarding state-mutating clicks. #36 confirmed the add-to-cart, checkout, payment and account-creation paths, and the guest-checkout prompt was covered separately after run `34377839820`. Account deletion and logout are now guarded by `actAndVerifyOutcome` after both were observed failing in run `35213250293` (see ADR 0001). The "Continue" link that follows a confirmed deletion was a separate, still-bare click, and on 2026-09-20 it was observed failing on firefox in a local `RETRIES=0` full run: `@CHECKOUT012` reported `TimeoutError: locator.click` at `pages/AccountPage.ts`, on `waiting for scheduled navigations to finish`, in cleanup and after the deletion itself had been confirmed - so nothing leaked, but the run failed. It now goes through `AccountPage.continueFromConfirmation`, which wraps both confirmation pages' Continue links in `actAndExpectHealthyNavigation` exactly as the account-created path already did. Repeating that click is safe because it only navigates home; that is what separates it from the delete it follows. Still unconfirmed and unproven either way: `CartPage.removeProduct`, `LoginPage.login`, `ContactPage.submitForm`, and `ProductDetailPage.submitReview` (the `@PROD008` review submission, which #42 moved out of the spec into the page object without guarding it). None of those has been observed flaking, so classify from evidence before changing any of them - `BasePage.submitSubscription` is the standing example of a bare click that is correct as written, because its handler emits no request.
- Known hole, accepted rather than closed: `coverage:check` verifies only the text between the `<!-- coverage:start -->` / `<!-- coverage:end -->` markers in `README.md` and `AGENTS.md` (`scripts/coverage-counts.ts:82-115`). Every typed total outside those markers, in any file, is unguarded - so nothing mechanically prevents scenario totals being typed back into `docs/test-strategy.md` or into README prose. The typed totals there were removed, and that file states its totals live in the generated tables - extending the checker was judged more surface area than the drift justifies.
- Consolidate remaining scenario-specific selectors through focused pull requests.
- API lifecycle, next: three clean manual CI dispatches of `suite: lifecycle`, each bare, with zero leftovers and cleanup evidence whose run ID matches the run. Only after those three does the promotion follow - extending the existing automatic `live-contract` job with the lifecycle steps behind `if: success()`, with no new trigger and no second entry in the shared queue - and only then may a verified-run citation or any recruiter-facing claim about write coverage be written down. Until then the public wording says manual and generated-accounts-only, which is what it currently says.
- API contract, next: the one-way product-data cross-check (API tests confirm the IDs, names and prices in `test-data/products.ts`), as its own pull request. An API check posted on pull requests was deliberately deferred on 2026-09-19: it would add live requests and queue contention on every PR push for little coverage the post-regression runs do not already give. The live API job stays in the shared concurrency group: a queued job there can cancel a pending one, which costs at most one API run that the next regression replaces, while a separate group would let API requests overlap browser tests.
- Use `npm run triage:failures` as the evidence source for future issue creation integrations.
