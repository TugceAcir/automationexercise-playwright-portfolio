import { test, expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { createTestUser } from '../../test-data/user.factory';
import { deleteAccountIfPresent, expectHtml5ValidationMessage, logInExistingCustomer, logOut, registerCustomer } from '../support/test-actions';

test.describe('Authentication and account lifecycle', () => {
  test('@AUTH001 @auth @smoke new customer can register and delete the account', async ({ homePage, loginPage, accountPage }) => {
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

  test('@AUTH002 @auth @regression invalid login shows a clear error', async ({ homePage, loginPage }) => {
    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectLoginForm();

    await loginPage.login('not-a-real-user@example.com', 'wrong-password');

    await loginPage.expectInvalidLoginMessage();
  });

  test('@AUTH003 @auth @regression registered customer can log out and log back in', async ({ page }) => {
    const user = createTestUser('login');

    try {
      await registerCustomer(page, user);
      await logOut(page);

      await logInExistingCustomer(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@AUTH004 @auth @regression signup blocks an email that already exists', async ({ page }) => {
    const user = createTestUser('duplicate');
    const homePage = new HomePage(page);
    const loginPage = new LoginPage(page);

    try {
      await registerCustomer(page, user);
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

  test('@AUTH005 @auth @negative login requires email and password', async ({ homePage, loginPage, page }) => {
    await homePage.open();
    await homePage.navigateToSignupLogin();
    await loginPage.expectLoginForm();

    await page.getByRole('button', { name: 'Login' }).click();

    await expectHtml5ValidationMessage(page.locator('[data-qa="login-email"]'), /fill out this field|required/i);
  });

  test('@AUTH006 @auth @negative signup requires name and a valid email', async ({ homePage, loginPage, page }) => {
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

  test('@AUTH007 @auth @edge signup accepts names with punctuation and spaces', async ({ page }) => {
    const user = {
      ...createTestUser('edge-name'),
      name: "QA Edge O'Connor-Smith Jr."
    };

    try {
      await registerCustomer(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@AUTH008 @auth @session logged-in session survives page refresh', async ({ page }) => {
    const user = createTestUser('refresh');
    const accountPage = new AccountPage(page);

    try {
      await registerCustomer(page, user);

      await page.reload();

      await accountPage.expectLoggedInAs(user.name);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@AUTH009 @auth @session logged-in session survives browser back navigation', async ({ page }) => {
    const user = createTestUser('back');
    const accountPage = new AccountPage(page);

    try {
      await registerCustomer(page, user);
      await page.getByRole('link', { name: 'Products' }).click();
      await expect(page).toHaveURL(/\/products/);

      await page.goBack();

      await accountPage.expectLoggedInAs(user.name);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

});
