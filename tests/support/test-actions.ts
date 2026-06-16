import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { ProductsPage } from '../../pages/ProductsPage';
import type { TestUser } from '../../test-data/user.factory';

export async function registerCustomer(page: Page, user: TestUser): Promise<void> {
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

export async function logInExistingCustomer(page: Page, user: TestUser): Promise<void> {
  const loginPage = new LoginPage(page);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await loginPage.expectLoginForm();
  await loginPage.login(user.email, user.password);
  await new AccountPage(page).expectLoggedInAs(user.name);
}

export async function logOut(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Login to your account' })).toBeVisible();
}

export async function deleteAccountIfPresent(page: Page): Promise<void> {
  const deleteLink = page.getByRole('link', { name: 'Delete Account' });
  if (!(await deleteLink.isVisible().catch(() => false))) {
    return;
  }

  await deleteLink.click().catch(() => undefined);

  if (!(await page.locator('[data-qa="account-deleted"]').isVisible().catch(() => false))) {
    await page.goto('/delete_account', { waitUntil: 'domcontentloaded' });
  }

  await expect(page.locator('[data-qa="account-deleted"]')).toBeVisible();
  await page.locator('[data-qa="continue-button"]').click();
}

export async function addProductsToCart(page: Page, productIds: number[]): Promise<void> {
  const homePage = new HomePage(page);
  const productsPage = new ProductsPage(page);

  await homePage.open();
  await homePage.navigateToProducts();
  await productsPage.expectAllProductsLoaded();

  for (let index = 0; index < productIds.length; index += 1) {
    await productsPage.addProductToCart(productIds[index]);

    if (index === productIds.length - 1) {
      await productsPage.viewCartFromModal();
    } else {
      await productsPage.continueShopping();
    }
  }
}

export async function expectHtml5ValidationMessage(locator: Locator, message: RegExp): Promise<void> {
  await expect.poll(async () => locator.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.validationMessage)).toMatch(message);
}

export async function blockThirdPartyNoiseForContext(context: BrowserContext): Promise<void> {
  await context.route(/.*(googlesyndication|doubleclick|googleadservices|adservice|adsystem|fundingchoices).*/, async (route) => {
    await route.abort();
  });
}
