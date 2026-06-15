import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { createTestUser } from '../../test-data/user.factory';
import type { TestUser } from '../../test-data/user.factory';

async function signUpNewCustomer(page: Page, user: TestUser): Promise<void> {
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);
  const accountPage = new AccountPage(page);

  await homePage.open();
  await homePage.navigateToSignupLogin();
  await loginPage.expectSignupForm();
  await loginPage.startSignup(user);
  await loginPage.completeAccountInformation(user);
  await accountPage.expectAccountCreated();
  await accountPage.continueAfterAccountCreated();
  await accountPage.expectLoggedInAs(user.name);
}

async function logInExistingCustomer(page: Page, user: TestUser): Promise<void> {
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);
  const accountPage = new AccountPage(page);

  await homePage.open();
  await homePage.navigateToSignupLogin();
  await loginPage.expectLoginForm();
  await loginPage.login(user.email, user.password);
  await accountPage.expectLoggedInAs(user.name);
}

async function logOut(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
}

async function deleteAccountIfPresent(page: Page): Promise<void> {
  const deleteLink = page.getByRole('link', { name: 'Delete Account' });
  if (!(await deleteLink.isVisible().catch(() => false))) {
    return;
  }

  await deleteLink.click().catch(() => undefined);

  if (!(await page.locator('[data-qa="account-deleted"]').isVisible().catch(() => false))) {
    await page.goto('/delete_account');
  }

  await expect(page.locator('[data-qa="account-deleted"]')).toBeVisible();
  await page.locator('[data-qa="continue-button"]').click();
}

async function expectHtml5ValidationMessage(locator: ReturnType<Page['locator']>, message: RegExp): Promise<void> {
  await expect.poll(async () => locator.evaluate((element: HTMLInputElement) => element.validationMessage)).toMatch(message);
}

test.describe('Authentication and account lifecycle', () => {
  test('@smoke new customer can register and delete the account', async ({ homePage, loginPage, accountPage }) => {
    const user = createTestUser('register');

    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectSignupForm();
    await loginPage.startSignup(user);
    await loginPage.completeAccountInformation(user);
    await accountPage.expectAccountCreated();
    await accountPage.continueAfterAccountCreated();
    await accountPage.expectLoggedInAs(user.name);

    await accountPage.deleteAccountIfLoggedIn();
  });

  test('@regression invalid login shows a clear error', async ({ homePage, loginPage }) => {
    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectLoginForm();

    await loginPage.login('not-a-real-user@example.com', 'wrong-password');

    await loginPage.expectInvalidLoginMessage();
  });

  test('@auth @regression registered customer can log out and log back in', async ({ page }) => {
    const user = createTestUser('login');

    try {
      await signUpNewCustomer(page, user);
      await logOut(page);

      await logInExistingCustomer(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@auth @regression signup blocks an email that already exists', async ({ page }) => {
    const user = createTestUser('duplicate');
    const homePage = new HomePage(page);
    const loginPage = new LoginPage(page);

    try {
      await signUpNewCustomer(page, user);
      await logOut(page);

      await homePage.open();
      await homePage.navigateToSignupLogin();
      await loginPage.startSignup(user);

      await loginPage.expectExistingEmailMessage();
    } finally {
      await logInExistingCustomer(page, user).catch(() => undefined);
      await deleteAccountIfPresent(page);
    }
  });

  test('@auth @negative login requires email and password', async ({ homePage, loginPage, page }) => {
    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectLoginForm();

    await page.getByRole('button', { name: 'Login' }).click();

    await expectHtml5ValidationMessage(page.locator('[data-qa="login-email"]'), /fill out this field|required/i);
  });

  test('@auth @negative signup requires name and a valid email', async ({ homePage, loginPage, page }) => {
    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectSignupForm();

    await page.getByRole('button', { name: 'Signup' }).click();
    await expectHtml5ValidationMessage(page.getByPlaceholder('Name'), /fill out this field|required/i);

    await page.getByPlaceholder('Name').fill('Invalid Email User');
    await page.locator('[data-qa="signup-email"]').fill('not-an-email');
    await page.getByRole('button', { name: 'Signup' }).click();

    await expectHtml5ValidationMessage(page.locator('[data-qa="signup-email"]'), /include an '@'|valid email/i);
  });

  test('@auth @edge signup accepts names with punctuation and spaces', async ({ page }) => {
    const user = {
      ...createTestUser('edge-name'),
      name: "QA Edge O'Connor-Smith Jr."
    };

    try {
      await signUpNewCustomer(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@auth @session logged-in session survives page refresh', async ({ page }) => {
    const user = createTestUser('refresh');
    const accountPage = new AccountPage(page);

    try {
      await signUpNewCustomer(page, user);

      await page.reload();

      await accountPage.expectLoggedInAs(user.name);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@auth @session logged-in session survives browser back navigation', async ({ page }) => {
    const user = createTestUser('back');
    const accountPage = new AccountPage(page);

    try {
      await signUpNewCustomer(page, user);
      await page.getByRole('link', { name: 'Products' }).click();
      await expect(page).toHaveURL(/\/products/);

      await page.goBack();

      await accountPage.expectLoggedInAs(user.name);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

});
