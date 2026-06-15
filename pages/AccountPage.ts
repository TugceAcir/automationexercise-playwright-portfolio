import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectAccountCreated(): Promise<void> {
    await expect(this.page.locator('[data-qa="account-created"]')).toBeVisible();
  }

  async continueAfterAccountCreated(): Promise<void> {
    await this.page.locator('[data-qa="continue-button"]').click();
    await this.dismissConsentIfPresent();
  }

  async expectLoggedInAs(name: string): Promise<void> {
    await expect(this.page.getByText(`Logged in as ${name}`)).toBeVisible();
  }

  async deleteAccountIfLoggedIn(): Promise<void> {
    const deleteLink = this.page.getByRole('link', { name: 'Delete Account' });
    if (await deleteLink.isVisible().catch(() => false)) {
      await deleteLink.click();
      await expect(this.page.locator('[data-qa="account-deleted"]')).toBeVisible();
      await this.page.locator('[data-qa="continue-button"]').click();
    }
  }
}
