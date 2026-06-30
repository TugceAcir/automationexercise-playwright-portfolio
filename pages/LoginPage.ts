import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndConfirmDemoRequest, actAndExpectHealthyNavigation, expectHealthyDemoPage, gotoDemoPage, isTransientDemoPageError } from './app-navigation';
import type { TestUser } from '../test-data/user.factory';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectLoginForm(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
  }

  async expectSignupForm(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'New User Signup!' })).toBeVisible();
  }

  async startSignup(user: TestUser): Promise<void> {
    await this.page.getByPlaceholder('Name').fill(user.name);
    await this.page.locator('[data-qa="signup-email"]').fill(user.email);
    await this.page.getByRole('button', { name: 'Signup' }).click();
    await this.waitForLoginDomContentLoadedIfNavigating();
  }

  async completeAccountInformation(user: TestUser): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page.getByText('Enter Account Information')).toBeVisible();
    await this.fillAccountInformationFields(user);
    await actAndConfirmDemoRequest(this.page, {
      act: async () => this.page.getByRole('button', { name: 'Create Account' }).click(),
      requestMatches: (request) => {
        const url = new URL(request.url());
        return request.method() === 'POST' && url.pathname === '/signup';
      },
      operationName: 'Creating the customer account'
    });

    try {
      await expectHealthyDemoPage(this.page);
    } catch (error) {
      if (isTransientDemoPageError(error)) {
        throw new Error('The account-creation request was submitted, but the demo site returned a transient error page. The account outcome is uncertain; the request was not repeated.', { cause: error });
      }

      throw error;
    }

    await expect(this.page).toHaveURL(/\/account_created/, { timeout: 20_000 });
  }

  private async fillAccountInformationFields(user: TestUser): Promise<void> {
    const titleRadio = this.page.locator('#id_gender1');

    await titleRadio.check();
    await expect(titleRadio).toBeChecked({ timeout: 1_000 });
    await this.page.locator('#password').fill(user.password);
    await this.page.locator('#days').selectOption(user.birthDay);
    await this.page.locator('#months').selectOption(user.birthMonth);
    await this.page.locator('#years').selectOption(user.birthYear);
    await this.page.locator('#newsletter').check();
    await this.page.locator('#optin').check();
    await this.page.locator('#first_name').fill(user.firstName);
    await this.page.locator('#last_name').fill(user.lastName);
    await this.page.locator('#company').fill(user.company);
    await this.page.locator('#address1').fill(user.address1);
    await this.page.locator('#address2').fill(user.address2);
    await this.page.locator('#country').selectOption(user.country);
    await this.page.locator('#state').fill(user.state);
    await this.page.locator('#city').fill(user.city);
    await this.page.locator('#zipcode').fill(user.zipCode);
    await this.page.locator('#mobile_number').fill(user.mobileNumber);
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillLoginCredentials(email, password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async loginSuccessfully(email: string, password: string): Promise<void> {
    const emailInput = this.page.locator('[data-qa="login-email"]');
    const passwordInput = this.page.locator('[data-qa="login-password"]');
    const loginButton = this.page.getByRole('button', { name: 'Login' });
    const logoutLink = this.page.getByRole('link', { name: 'Logout' });

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await emailInput.fill(email);
        await passwordInput.fill(password);
        await loginButton.click();
      },
      expectReady: async () => {
        await expect(logoutLink).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/login');
      },
      retryOnNavigationTimeout: true
    });
  }

  private async fillLoginCredentials(email: string, password: string): Promise<void> {
    await this.page.locator('[data-qa="login-email"]').fill(email);
    await this.page.locator('[data-qa="login-password"]').fill(password);
  }

  async expectInvalidLoginMessage(): Promise<void> {
    await this.waitForLoginDomContentLoadedIfNavigating();
    await expect(this.page.getByText('Your email or password is incorrect!')).toBeVisible();
  }

  async expectExistingEmailMessage(): Promise<void> {
    await expect(this.page.getByText('Email Address already exist!')).toBeVisible();
  }

  private async waitForLoginDomContentLoadedIfNavigating(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
  }
}
