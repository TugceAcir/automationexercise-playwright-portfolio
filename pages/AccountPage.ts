import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectHealthyDemoPage } from './app-navigation';

export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectAccountCreated(): Promise<void> {
    const accountCreated = this.page.locator('[data-qa="account-created"]');

    await expect(async () => {
      await expectHealthyDemoPage(this.page);

      if (!(await accountCreated.isVisible().catch(() => false)) && /\/account_created/.test(this.page.url())) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
      }

      await expect(accountCreated).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
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
    await expect(this.page.getByText(`Logged in as ${name}`)).toBeVisible({ timeout: 20_000 });
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
