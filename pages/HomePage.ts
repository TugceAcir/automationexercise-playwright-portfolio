import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

const SUBSCRIBE_CONFIRM_TIMEOUT = 5_000;
const SUBSCRIBE_RETRY_TIMEOUT = 30_000;

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.goto('/');
  }

  async expectLoaded(): Promise<void> {
    await this.expectPageTitle();
    await expect(this.page.getByRole('heading', { name: 'AutomationExercise' }).first()).toBeVisible();
    await expect(this.page.getByText('Full-Fledged practice website for Automation Engineers').first()).toBeVisible();
  }

  async subscribe(email: string): Promise<void> {
    const emailField = this.page.locator('#susbscribe_email');

    await emailField.scrollIntoViewIfNeeded();

    // Subscribing is handled entirely in the page's own JavaScript - it emits no
    // application request - so actAndConfirmDemoRequest() has nothing to confirm here.
    // A click that lands before the submit handler is bound is lost silently: no
    // request, no error, the field keeps its value and the alert never appears.
    // Re-issue the click until the success alert proves the handler ran.
    await expect(async () => {
      if (await this.hasSubscriptionSuccess()) {
        return;
      }

      await emailField.fill(email);
      await this.page.locator('#subscribe').click();
      await expect(this.subscriptionSuccessAlert()).toBeVisible({ timeout: SUBSCRIBE_CONFIRM_TIMEOUT });
    }).toPass({ timeout: SUBSCRIBE_RETRY_TIMEOUT });
  }

  async expectSubscriptionSuccess(): Promise<void> {
    await expect(this.subscriptionSuccessAlert()).toBeVisible();
  }

  private subscriptionSuccessAlert(): Locator {
    return this.page.getByText('You have been successfully subscribed!');
  }

  // Must return a boolean rather than assert, so an unconfirmed subscription always
  // reaches the retry above instead of failing the run from inside the check.
  private async hasSubscriptionSuccess(): Promise<boolean> {
    return this.subscriptionSuccessAlert()
      .isVisible()
      .catch(() => false);
  }
}
