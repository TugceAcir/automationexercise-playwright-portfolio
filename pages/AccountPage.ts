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
    const continueButton = this.page.locator('[data-qa="continue-button"]');

    await expect(async () => {
      await continueButton.click();
      await this.dismissConsentIfPresent();
      await expect(this.page.locator('[data-qa="account-created"]')).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
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
