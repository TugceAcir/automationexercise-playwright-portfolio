# Contributing

This project is a QA automation portfolio, so changes should be easy to review as both code and evidence. Issues and pull requests are welcome as discussion, but changes may not be merged if they do not fit the portfolio scope.

For architecture rules, suite ownership, locator guidance, and current priorities, read [AGENTS.md](AGENTS.md) before changing tests, page objects, reports, or documentation. Pull requests should follow the repository's [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

## Workflow

1. Work on a short-lived branch.
2. Describe the user risk or framework concern the change addresses.
3. Keep page objects focused on user actions and assertions.
4. Keep transient demo-site recovery inside `pages/app-navigation.ts`.
5. Run focused validation first, then full validation when shared helpers, page objects, config, or reporting changed.

## Validation

For code or test changes, run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:cross-platform
npm run business-report
```

Run the full `npx playwright test` suite only when shared helpers, page objects, configuration, workflows, or release evidence changed. See [AGENTS.md](AGENTS.md).

If Playwright fails, run:

```bash
npm run triage:failures
```

Classify failures before changing code: product, test, environment, or data.

## License

By contributing, you agree that your contribution is provided under the repository's [MIT License](LICENSE).
