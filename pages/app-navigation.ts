import { expect, type Page } from '@playwright/test';

const DEMO_SITE_ERROR_PATTERN = /500 Internal Server Error|Error code 520|queue full|too many people are accessing this website|Web server is returning an unknown error/i;

export async function expectHealthyDemoPage(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');

  if (DEMO_SITE_ERROR_PATTERN.test(bodyText)) {
    throw new Error('Automation Exercise returned a transient server/load error page.');
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
