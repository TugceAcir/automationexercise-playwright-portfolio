import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { BOT_CHALLENGE_ERROR, DEMO_SITE_ERROR_PATTERN, TRANSIENT_DEMO_SITE_ERROR, UNCERTAIN_ACTION_OUTCOME_ERROR, isBotChallenge } from '../shared/demo-site-classification';

export const DEMO_NAVIGATION_RETRY_TIMEOUT = 60_000;
export const DEMO_POST_SUBMIT_TIMEOUT = 60_000;
export const DEMO_DOWNLOAD_TIMEOUT = 30_000;

export async function expectHealthyDemoPage(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');

  if (page.url() !== 'about:blank' && isBotChallenge(bodyText)) {
    throw new Error(BOT_CHALLENGE_ERROR);
  }

  if (page.url() !== 'about:blank' && (!bodyText.trim() || DEMO_SITE_ERROR_PATTERN.test(bodyText))) {
    throw new Error(TRANSIENT_DEMO_SITE_ERROR);
  }
}

export async function gotoDemoPage(page: Page, path: string): Promise<void> {
  await expect(async () => {
    await navigateToDemoPath(page, path);
    await expectHealthyDemoPage(page);
  }).toPass({ timeout: DEMO_NAVIGATION_RETRY_TIMEOUT });
}

export async function reloadDemoPage(page: Page): Promise<void> {
  await expect(async () => {
    await reloadDemoPath(page);
    await expectHealthyDemoPage(page);
  }).toPass({ timeout: DEMO_NAVIGATION_RETRY_TIMEOUT });
}

export function isTransientDemoPageError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(TRANSIENT_DEMO_SITE_ERROR);
}

export async function actAndConfirmDemoRequest(
  page: Page,
  options: {
    act: () => Promise<void>;
    requestMatches: (request: Request) => boolean;
    operationName: string;
    retryServerError?: boolean;
    maxUncommittedRetries?: number;
    // Proof that the action already took effect, used only when the expected request
    // was not observed. Without it, a request missed inside the wait window causes the
    // action to be repeated against a page that has already moved on. Must return a
    // boolean rather than assert: a "not committed" answer has to reach the retry.
    isCommitted?: () => Promise<boolean>;
  }
): Promise<void> {
  const maxUncommittedRetries = options.maxUncommittedRetries ?? 1;

  for (let attempt = 0; attempt <= maxUncommittedRetries; attempt += 1) {
    const requestPromise = page.waitForRequest(options.requestMatches, { timeout: 3_000 }).catch(() => undefined);

    await options.act();

    const request = await requestPromise;
    if (!request) {
      // The request may have been issued and simply missed. Repeating a committed
      // action is worse than missing its request, so confirm the page state first.
      if (await hasCommitted(options.isCommitted)) {
        return;
      }

      if (attempt < maxUncommittedRetries) {
        continue;
      }

      throw new Error(`${options.operationName} did not emit its expected application request.`);
    }

    const response = await request.response();

    // A null response means the request was issued but never answered — aborted by a
    // navigation, or a network failure. Returning here would report a write that never
    // landed as a success, so it takes the same path as a request that was never seen.
    if (!response) {
      if (await hasCommitted(options.isCommitted)) {
        return;
      }

      if (attempt < maxUncommittedRetries) {
        continue;
      }

      throw new Error(`${options.operationName} sent its request but never received a response.`);
    }

    if (response.status() >= 500 && options.retryServerError) {
      if (attempt < maxUncommittedRetries) {
        continue;
      }

      throw new Error(`${options.operationName} returned HTTP ${response.status()} after ${attempt + 1} attempts.`);
    }

    return;
  }
}

export async function actAndExpectHealthyNavigation(
  page: Page,
  options: {
    act: () => Promise<void>;
    expectReady: () => Promise<void>;
    recover: () => Promise<void>;
    acceptAlreadyReady?: boolean;
    maxTransientRetries?: number;
    retryOnNavigationTimeout?: boolean;
  }
): Promise<void> {
  const maxTransientRetries = options.maxTransientRetries ?? 1;

  for (let attempt = 0; attempt <= maxTransientRetries; attempt += 1) {
    await expectHealthyDemoPage(page);

    if (options.acceptAlreadyReady) {
      try {
        await options.expectReady();
        return;
      } catch {
        // Continue to the user action; the page is healthy but not at the expected state yet.
      }
    }

    const urlBeforeAction = page.url();

    try {
      await options.act();
    } catch (error) {
      if (await isExpectedStateAfterAction(page, options.expectReady)) {
        return;
      }

      if (
        attempt < maxTransientRetries &&
        options.retryOnNavigationTimeout &&
        isTimeoutError(error) &&
        (page.url() !== urlBeforeAction || (await isCurrentPageTransientDemoError(page)))
      ) {
        await options.recover();
        continue;
      }

      throw error;
    }

    try {
      await expectHealthyDemoPage(page);
    } catch (error) {
      if (attempt < maxTransientRetries && isTransientDemoPageError(error)) {
        await options.recover();
        continue;
      }

      throw error;
    }

    await options.expectReady();
    return;
  }
}

export type ActionOutcome = 'committed' | 'not-committed' | 'unknown';

const TRANSIENT_READINGS_REQUIRED = 2;
const CONFIRMATION_POLL_INTERVAL = 500;

// For a state-changing action whose result can be proven afterwards from a fresh, healthy
// page - logging out, deleting an account. Replaying such an action blind after a
// transient error page is wrong both ways: if it landed, the control it needs is gone and
// the replay fails on a correct page; if it was destructive, a replay could act twice.
// So when a transient page arrives instead of the confirmation, verifyOutcome() decides
// what happened, and the action is repeated only when that proof shows it did not land.
// An outcome that cannot be proven either way is reported as an environment failure.
// A healthy page that lacks the confirmation is never recovered - it stays a visible
// failure, as ADR 0001 requires.
export async function actAndVerifyOutcome(
  page: Page,
  options: {
    act: () => Promise<void>;
    // Must be absent until the action completes, or the wait would pass before it lands.
    confirmation: Locator;
    // Runs only after a confirmed transient error page. May navigate, via gotoDemoPage.
    verifyOutcome: () => Promise<ActionOutcome>;
    operationName: string;
    confirmationTimeout?: number;
    maxUncommittedRetries?: number;
  }
): Promise<'confirmed' | 'verified'> {
  const maxUncommittedRetries = options.maxUncommittedRetries ?? 1;

  for (let attempt = 0; ; attempt += 1) {
    await expectHealthyDemoPage(page);

    const reached = await actAndAwaitConfirmation(page, options.act, options.confirmation, options.confirmationTimeout ?? DEMO_POST_SUBMIT_TIMEOUT);
    if (reached === 'confirmed') {
      return 'confirmed';
    }

    const outcome = await resolveOutcome(options.verifyOutcome);
    if (outcome === 'committed') {
      return 'verified';
    }

    if (outcome === 'not-committed' && attempt < maxUncommittedRetries) {
      continue;
    }

    if (outcome === 'not-committed') {
      throw new Error(`${options.operationName} did not take effect after ${attempt + 1} attempts. ${TRANSIENT_DEMO_SITE_ERROR}`);
    }

    throw new Error(`${options.operationName}: ${UNCERTAIN_ACTION_OUTCOME_ERROR}`);
  }
}

async function actAndAwaitConfirmation(
  page: Page,
  act: () => Promise<void>,
  confirmation: Locator,
  timeout: number
): Promise<'confirmed' | 'transient'> {
  try {
    await act();
  } catch (error) {
    if (isTimeoutError(error) && (await isCurrentPageTransientDemoError(page))) {
      return 'transient';
    }

    throw error;
  }

  const deadline = Date.now() + timeout;
  let transientReadings = 0;

  while (Date.now() < deadline) {
    if (await confirmation.isVisible().catch(() => false)) {
      return 'confirmed';
    }

    // A page caught mid-navigation can read as blank, which expectHealthyDemoPage counts as
    // transient. Requiring consecutive readings keeps that from triggering a verification.
    transientReadings = (await isCurrentPageTransientDemoError(page)) ? transientReadings + 1 : 0;
    if (transientReadings >= TRANSIENT_READINGS_REQUIRED) {
      return 'transient';
    }

    await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_POLL_INTERVAL));
  }

  // Out of time on a page that is neither confirmed nor transient. Let a bot challenge name
  // itself, then fail the way a plain assertion would.
  await expectHealthyDemoPage(page);
  await expect(confirmation).toBeVisible({ timeout: 1_000 });
  return 'confirmed';
}

// Like hasCommitted: a verification that throws has proven nothing.
async function resolveOutcome(verifyOutcome: () => Promise<ActionOutcome>): Promise<ActionOutcome> {
  try {
    return await verifyOutcome();
  } catch {
    return 'unknown';
  }
}

// Locator.isVisible() answers from the current DOM without waiting, so it cannot tell
// "not rendered yet" from "never rendered". Inside a committed-state check that reads as
// a false negative, and a false negative there replays a write that already landed. This
// waits for the element, and still answers with a boolean rather than throwing.
export async function becomesVisible(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

// A committed-state check must never decide the outcome by throwing. Any error means
// "not proven committed", so the caller falls through to its retry or its clear failure.
async function hasCommitted(isCommitted?: () => Promise<boolean>): Promise<boolean> {
  if (!isCommitted) return false;

  try {
    return await isCommitted();
  } catch {
    return false;
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

async function navigateToDemoPath(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    if (await isHealthyPageAtPath(page, path)) {
      return;
    }

    throw error;
  }
}

async function reloadDemoPath(page: Page): Promise<void> {
  const path = new URL(page.url()).pathname;

  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } catch (error) {
    if (await isHealthyPageAtPath(page, path)) {
      return;
    }

    throw error;
  }
}

async function isHealthyPageAtPath(page: Page, path: string): Promise<boolean> {
  const expectedPath = path.startsWith('/') ? path : new URL(path).pathname;
  const currentPath = new URL(page.url()).pathname;

  if (currentPath !== expectedPath) {
    return false;
  }

  return expectHealthyDemoPage(page)
    .then(() => true)
    .catch(() => false);
}

async function isCurrentPageTransientDemoError(page: Page): Promise<boolean> {
  try {
    await expectHealthyDemoPage(page);
    return false;
  } catch (error) {
    return isTransientDemoPageError(error);
  }
}

async function isExpectedStateAfterAction(page: Page, expectReady: () => Promise<void>): Promise<boolean> {
  try {
    await expectHealthyDemoPage(page);
    await expectReady();
    return true;
  } catch {
    return false;
  }
}
