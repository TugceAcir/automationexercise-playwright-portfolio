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

  /**
   * Leaves an account-created or account-deleted confirmation page by its "Continue" link.
   *
   * It is the same control on both pages and it only navigates home, which is why repeating it
   * is safe - unlike the delete it follows. The demo site sometimes performs the navigation but
   * never lets it settle, so a bare click can time out after the page has already moved; the
   * readiness check is the confirmation banner disappearing, which is true the moment it has.
   */
  private async continueFromConfirmation(confirmation: 'account-created' | 'account-deleted'): Promise<void> {
    const continueButton = this.page.locator('[data-qa="continue-button"]');

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(continueButton).toBeVisible();
        await continueButton.click();
      },
      expectReady: async () => {
        await expect(this.page.locator(`[data-qa="${confirmation}"]`)).toBeHidden();
      },
      recover: async () => {
        await reloadDemoPage(this.page);
      },
      acceptAlreadyReady: true,
      retryOnNavigationTimeout: true
    });

    await this.dismissConsentIfPresent();
  }

  async continueAfterAccountCreated(): Promise<void> {
    await this.continueFromConfirmation('account-created');
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

    // Observed failing on firefox on 2026-09-20: the deletion itself was confirmed, then this
    // bare click timed out on "waiting for scheduled navigations to finish" and failed the run
    // in cleanup, after the work that mattered had already succeeded.
    if (result === 'confirmed') {
      await this.continueFromConfirmation('account-deleted');
    }
  }
}

// A login that succeeds also restores the session, which is what a repeated delete needs.
function deletionOutcome(presence: AccountPresence): ActionOutcome {
  if (presence === 'absent') return 'committed';
  if (presence === 'present') return 'not-committed';
  return 'unknown';
}
