import { test, type BrowserContext, type TestInfo } from '@playwright/test';
import { resolveBaseUrl } from '../shared/base-url';
import { DEMO_SITE_SERVER_ERRORS_ANNOTATION, formatServerErrorCounts, isDemoSiteUrl, type ServerErrorCounts } from '../shared/demo-site-server-errors';

// Counts the demo site's 5xx responses for each test attempt, so a failed run can show how
// unavailable the site was instead of only that a test failed. Observation only: nothing
// here waits, retries or changes a response, so it stays outside the ADR 0001 boundary.

const baseUrl = resolveBaseUrl();
const countsByAttempt = new WeakMap<TestInfo, ServerErrorCounts>();
const trackedContexts = new WeakSet<BrowserContext>();

// Defaults to the running test, so a context a spec opens itself can be tracked from a helper.
export function trackDemoSiteServerErrors(context: BrowserContext, testInfo: TestInfo = test.info()): void {
  if (trackedContexts.has(context)) return;
  trackedContexts.add(context);

  let counts = countsByAttempt.get(testInfo);
  if (!counts) {
    counts = {};
    countsByAttempt.set(testInfo, counts);
  }

  const attemptCounts = counts;
  context.on('response', (response) => {
    const status = response.status();
    if (status >= 500 && status <= 599 && isDemoSiteUrl(response.url(), baseUrl)) {
      attemptCounts[status] = (attemptCounts[status] ?? 0) + 1;
    }
  });
}

// Adds the annotation only when something was counted, so clean attempts stay unannotated.
export function recordDemoSiteServerErrors(testInfo: TestInfo): void {
  const description = formatServerErrorCounts(countsByAttempt.get(testInfo) ?? {});
  if (description) {
    testInfo.annotations.push({ type: DEMO_SITE_SERVER_ERRORS_ANNOTATION, description });
  }
}
