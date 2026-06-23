import { expect, type Page } from '@playwright/test';

const DEMO_SITE_ERROR_PATTERN = /500 Internal Server Error|Error code 520|queue full|too many people are accessing this website|Web server is returning an unknown error/i;
const TRANSIENT_DEMO_SITE_ERROR = 'Automation Exercise returned a transient server/load error page.';

export async function expectHealthyDemoPage(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');

  if (page.url() !== 'about:blank' && (!bodyText.trim() || DEMO_SITE_ERROR_PATTERN.test(bodyText))) {
    throw new Error(TRANSIENT_DEMO_SITE_ERROR);
  }
}

export async function gotoDemoPage(page: Page, path: string): Promise<void> {
  await expect(async () => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectHealthyDemoPage(page);
  }).toPass({ timeout: 45_000 });
}

export async function reloadDemoPage(page: Page): Promise<void> {
  await expect(async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
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

export async function actAndExpectHealthyNavigation(
  page: Page,
  options: {
    act: () => Promise<void>;
    expectReady: () => Promise<void>;
    recover: () => Promise<void>;
    acceptAlreadyReady?: boolean;
    maxTransientRetries?: number;
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

    await options.act();

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
