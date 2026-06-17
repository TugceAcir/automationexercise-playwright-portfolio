import { expect, type Page } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.dismissConsentIfPresent();
  }

  async expectPageTitle(): Promise<void> {
    await expect(this.page).toHaveTitle(/Automation Exercise/);
  }

  async navigateToProducts(): Promise<void> {
    await this.page.locator('a[href="/products"]').click();
    await this.dismissConsentIfPresent();
  }

  async navigateToCart(): Promise<void> {
    await this.page.locator('a[href="/view_cart"]').click();
    await this.dismissConsentIfPresent();
  }

  async navigateToSignupLogin(): Promise<void> {
    await this.page.locator('a[href="/login"]').click();
    await this.dismissConsentIfPresent();
  }

  async navigateToContactUs(): Promise<void> {
    await this.page.locator('a[href="/contact_us"]').click();
    await this.dismissConsentIfPresent();
  }

  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async continueShopping(): Promise<void> {
    const cartModal = this.page.locator('#cartModal');

    await cartModal.getByRole('button', { name: 'Continue Shopping' }).click();
    await expect(cartModal).toBeHidden();
    await expect(this.page.locator('.modal-backdrop')).toHaveCount(0);
  }

  async viewCartFromModal(): Promise<void> {
    await this.page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();
  }

  protected async expectCartModalVisible(): Promise<void> {
    await expect(this.page.locator('#cartModal')).toBeVisible();
  }

  protected async expectCartModalScriptReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const maybeWindow = window as typeof window & {
        jQuery?: { fn?: { modal?: unknown } };
      };

      return typeof maybeWindow.jQuery?.fn?.modal === 'function';
    });
  }

  protected async dismissConsentIfPresent(): Promise<void> {
    const consentButton = this.page
      .getByRole('button', { name: /consent|agree|accept|ok/i })
      .or(this.page.locator('.fc-cta-consent'))
      .or(this.page.locator('#dismiss-button'))
      .first();

    await consentButton.click({ timeout: 500 }).catch(() => undefined);
  }
}
