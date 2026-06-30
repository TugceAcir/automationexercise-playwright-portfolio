import { expect, type Page, type Request } from '@playwright/test';

const DEMO_SITE_ERROR_PATTERN = /500 Internal Server Error|503 Service Unavailable|Error code (?:503|520)|queue full|too many people are accessing this website|Web server is returning an unknown error/i;
const TRANSIENT_DEMO_SITE_ERROR = 'Automation Exercise returned a transient server/load error page.';

export async function expectHealthyDemoPage(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');

  if (page.url() !== 'about:blank' && (!bodyText.trim() || DEMO_SITE_ERROR_PATTERN.test(bodyText))) {
    throw new Error(TRANSIENT_DEMO_SITE_ERROR);
  }
}

export async function gotoDemoPage(page: Page, path: string): Promise<void> {
  await expect(async () => {
    await navigateToDemoPath(page, path);
    await expectHealthyDemoPage(page);
  }).toPass({ timeout: 45_000 });
}

export async function reloadDemoPage(page: Page): Promise<void> {
  await expect(async () => {
    await reloadDemoPath(page);
    await expectHealthyDemoPage(page);
  }).toPass({ timeout: 45_000 });
}

export async function expectHealthyDemoPageOrReloadCurrent(page: Page, expectedUrl: RegExp): Promise<void> {
  try {
    await expectHealthyDemoPage(page);
  } catch (error) {
    if (expectedUrl.test(page.url()) && isTransientDemoPageError(error)) {
      await reloadDemoPage(page);
      return;
    }

    throw error;
  }
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
  }
): Promise<void> {
  const maxUncommittedRetries = options.maxUncommittedRetries ?? 1;

  for (let attempt = 0; attempt <= maxUncommittedRetries; attempt += 1) {
    const requestPromise = page.waitForRequest(options.requestMatches, { timeout: 3_000 }).catch(() => undefined);

    await options.act();

    const request = await requestPromise;
    if (!request) {
      if (attempt < maxUncommittedRetries) {
        continue;
      }

      throw new Error(`${options.operationName} did not emit its expected application request.`);
    }

    const response = await request.response();
    if (response && response.status() >= 500 && options.retryServerError) {
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
        page.url() !== urlBeforeAction
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

async function isExpectedStateAfterAction(page: Page, expectReady: () => Promise<void>): Promise<boolean> {
  try {
    await expectHealthyDemoPage(page);
    await expectReady();
    return true;
  } catch {
    return false;
  }
}
