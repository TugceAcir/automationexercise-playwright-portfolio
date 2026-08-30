import { expect, type Locator } from '@playwright/test';

// Lives under pages/ rather than tests/support/ so page objects can reach it: test-actions.ts
// imports page objects, so importing it from a page object would close an import cycle.
// tests/support/test-actions.ts re-exports this for specs that assert on fields no page
// object owns yet.
export async function expectHtml5ValidationMessage(locator: Locator, message: RegExp): Promise<void> {
  await expect.poll(async () => locator.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.validationMessage)).toMatch(message);
}
