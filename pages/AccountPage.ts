import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DEMO_POST_SUBMIT_TIMEOUT, actAndExpectHealthyNavigation, actAndVerifyOutcome, expectHealthyDemoPage, reloadDemoPage, type ActionOutcome } from './app-navigation';
import { LoginPage, type AccountPresence } from './LoginPage';
import type { TestUser } from '../test-data/user.factory';

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

  // Deletes the logged-in customer's account. When the site answers the delete with a
  // transient error page, the outcome is proven with the account's own credentials rather
  // than by repeating the delete - see actAndVerifyOutcome and LoginPage.logInIfAccountExists.
  async deleteAccount(user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
    const deleteLink = this.page.getByRole('link', { name: 'Delete Account' });
    const loginPage = new LoginPage(this.page);

    const result = await actAndVerifyOutcome(this.page, {
      act: async () => {
        await expect(deleteLink).toBeVisible();
        await deleteLink.click();
      },
      confirmation: this.page.locator('[data-qa="account-deleted"]'),
      verifyOutcome: async () => deletionOutcome(await loginPage.logInIfAccountExists(user)),
      operationName: 'Deleting the customer account'
    });

    if (result === 'confirmed') {
      await this.page.locator('[data-qa="continue-button"]').click();
    }
  }
}

// A login that succeeds also restores the session, which is what a repeated delete needs.
function deletionOutcome(presence: AccountPresence): ActionOutcome {
  if (presence === 'absent') return 'committed';
  if (presence === 'present') return 'not-committed';
  return 'unknown';
}
