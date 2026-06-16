import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
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
  }

  async completeAccountInformation(user: TestUser): Promise<void> {
    await expect(this.page.getByText('Enter Account Information')).toBeVisible();
    await this.page.locator('#id_gender1').check();
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
    await this.page.getByRole('button', { name: 'Create Account' }).click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.locator('[data-qa="login-email"]').fill(email);
    await this.page.locator('[data-qa="login-password"]').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async expectInvalidLoginMessage(): Promise<void> {
    await expect(this.page.getByText('Your email or password is incorrect!')).toBeVisible();
  }

  async expectExistingEmailMessage(): Promise<void> {
    await expect(this.page.getByText('Email Address already exist!')).toBeVisible();
  }
}
