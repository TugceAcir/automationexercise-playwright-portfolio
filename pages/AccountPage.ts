import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DEMO_POST_SUBMIT_TIMEOUT, actAndExpectHealthyNavigation, expectHealthyDemoPage, reloadDemoPage } from './app-navigation';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectAccountCreated(): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page.locator('[data-qa="account-created"]')).toBeVisible({ timeout: DEMO_POST_SUBMIT_TIMEOUT });
  }

  async continueAfterAccountCreated(): Promise<void> {
    const continueButton = this.page.locator('[data-qa="continue-button"]');

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(continueButton).toBeVisible();
        await continueButton.click();
      },
      expectReady: async () => {
        await expect(this.page.locator('[data-qa="account-created"]')).toBeHidden();
      },
      recover: async () => {
        await reloadDemoPage(this.page);
      },
      acceptAlreadyReady: true,
      retryOnNavigationTimeout: true
    });

    await this.dismissConsentIfPresent();
  }

  async expectLoggedInAs(name: string): Promise<void> {
    await expect(this.page.getByText(`Logged in as ${name}`)).toBeVisible({ timeout: DEMO_POST_SUBMIT_TIMEOUT });
  }

  async deleteAccountIfLoggedIn(): Promise<void> {
    const deleteLink = this.page.getByRole('link', { name: 'Delete Account' });
    if (await deleteLink.isVisible().catch(() => false)) {
      await deleteLink.click();
      await expect(this.page.locator('[data-qa="account-deleted"]')).toBeVisible({ timeout: DEMO_POST_SUBMIT_TIMEOUT });
      await this.page.locator('[data-qa="continue-button"]').click();
    }
  }
}
