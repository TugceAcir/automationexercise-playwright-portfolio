import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { ProductDetailPage } from '../../pages/ProductDetailPage';
import { actAndExpectHealthyNavigation, expectHealthyDemoPage, gotoDemoPage } from '../../pages/app-navigation';
import type { TestUser } from '../../test-data/user.factory';
import { blockThirdPartyNoise } from '../../fixtures/network';

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
  const accountPage = new AccountPage(page);

  if (await page.getByText(`Logged in as ${user.name}`).isVisible().catch(() => false)) {
    return;
  }

  await gotoDemoPage(page, '/login');

  if (await page.getByText(`Logged in as ${user.name}`).isVisible().catch(() => false)) {
    return;
  }

  await loginPage.expectLoginForm();
  await loginPage.login(user.email, user.password);

  await expect(async () => {
    await accountPage.expectLoggedInAs(user.name);
  }).toPass({ timeout: 20_000 });
}

export async function logOut(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'Login to your account' });
  const logoutLink = page.getByRole('link', { name: 'Logout' });

  await expectHealthyDemoPage(page);
  if (await loginHeading.isVisible().catch(() => false)) {
    return;
  }

  await actAndExpectHealthyNavigation(page, {
    act: async () => {
      await expect(logoutLink).toBeVisible();
      await logoutLink.click({ noWaitAfter: true });
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    },
    expectReady: async () => {
      await expect(loginHeading).toBeVisible();
    },
    recover: async () => {
      await gotoDemoPage(page, '/');
    }
  });
}

export async function deleteAccountIfPresent(page: Page): Promise<void> {
  const deleteLink = page.getByRole('link', { name: 'Delete Account' });
  if (!(await deleteLink.isVisible().catch(() => false))) {
    return;
  }

  await deleteLink.click({ noWaitAfter: true }).catch(async () => {
    await gotoDemoPage(page, '/delete_account');
  });
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);

  if (!(await page.locator('[data-qa="account-deleted"]').isVisible().catch(() => false))) {
    // Cleanup recovery only: normal test flows must prove UI navigation rather than jump routes.
    await gotoDemoPage(page, '/delete_account');
  }

  await expect(page.locator('[data-qa="account-deleted"]')).toBeVisible();
  await page.locator('[data-qa="continue-button"]').click({ noWaitAfter: true });
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
}

export async function addProductsToCart(page: Page, productIds: number[]): Promise<void> {
  const productDetailPage = new ProductDetailPage(page);

  for (let index = 0; index < productIds.length; index += 1) {
    await addProductFromDetails(page, productIds[index]);

    if (index < productIds.length - 1) {
      await productDetailPage.continueShopping();
    }
  }
}

export async function addProductsAndOpenCart(page: Page, productIds: number[]): Promise<void> {
  await addProductsToCart(page, productIds);
  await new ProductDetailPage(page).viewCartFromModal();
}

export async function addProductFromDetails(page: Page, productId: number, quantity = '1'): Promise<void> {
  await new ProductDetailPage(page).open(productId);
  await addCurrentProductFromDetails(page, quantity);
}

export async function addCurrentProductFromDetails(page: Page, quantity = '1'): Promise<void> {
  await new ProductDetailPage(page).addCurrentProductToCart(quantity);
}

export async function expectHtml5ValidationMessage(locator: Locator, message: RegExp): Promise<void> {
  await expect.poll(async () => locator.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.validationMessage)).toMatch(message);
}

export async function blockThirdPartyNoiseForContext(context: BrowserContext): Promise<void> {
  await blockThirdPartyNoise(context);
}
