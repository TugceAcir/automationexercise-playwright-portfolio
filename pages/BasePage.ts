import { expect, type Locator, type Page } from '@playwright/test';
import { actAndExpectHealthyNavigation, expectHealthyDemoPage, gotoDemoPage } from './app-navigation';

export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  async goto(path = '/'): Promise<void> {
    await gotoDemoPage(this.page, path);
    await this.dismissConsentIfPresent();
  }

  async expectPageTitle(): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page).toHaveTitle(/Automation Exercise/);
  }

  async navigateToProducts(): Promise<void> {
    await this.navigateByHeaderLink('/products', this.page.getByRole('heading', { name: /All Products/i }));
  }

  async navigateToCart(): Promise<void> {
    await this.navigateByHeaderLink('/view_cart', this.page.locator('#cart_info'));
  }

  async navigateToSignupLogin(): Promise<void> {
    await this.navigateByHeaderLink('/login', this.page.getByRole('heading', { name: 'New User Signup!' }));
  }

  async navigateToContactUs(): Promise<void> {
    await this.navigateByHeaderLink('/contact_us', this.page.getByRole('heading', { name: 'Get In Touch' }));
  }

  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async continueShopping(): Promise<void> {
    const cartModal = this.page.locator('#cartModal');
    const continueButton = cartModal.getByRole('button', { name: 'Continue Shopping' });

    await expect(cartModal).toBeVisible();
    await continueButton.click();
    if (await cartModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
    }
    await expect(cartModal).toBeHidden();
    await expect(this.page.locator('.modal-backdrop')).toHaveCount(0);
  }

  async viewCartFromModal(): Promise<void> {
    const viewCartLink = this.page.locator('#cartModal').getByRole('link', { name: 'View Cart' });

    await actAndExpectHealthyNavigation(this.page, {
      acceptAlreadyReady: true,
      act: async () => {
        await this.expectCartModalVisible();
        await viewCartLink.click();
      },
      expectReady: async () => {
        await expect(this.page.locator('#cart_info')).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/view_cart');
      }
    });
  }

  protected async expectCartModalVisible(): Promise<void> {
    const cartModal = this.page.locator('#cartModal');

    await expect(cartModal).toBeVisible();
    await expect(cartModal.getByRole('heading', { name: 'Added!' })).toBeVisible();
    await expect(cartModal).toContainText('Your product has been added to cart.');
  }

  protected async expectCartModalScriptReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const maybeWindow = window as typeof window & {
        jQuery?: { fn?: { modal?: unknown } };
      };

      return typeof maybeWindow.jQuery?.fn?.modal === 'function';
    });
  }

  private async navigateByHeaderLink(path: string, destinationReady: Locator): Promise<void> {
    const headerLink = this.page.locator(`a[href="${path}"]`);

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(headerLink).toBeVisible();
        await headerLink.click();
      },
      expectReady: async () => {
        await expect(destinationReady).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/');
      },
      retryOnNavigationTimeout: true
    });

    await this.dismissConsentIfPresent();
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
