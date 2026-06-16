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
  const productsPage = new ProductsPage(page);

  for (let index = 0; index < productIds.length; index += 1) {
    await addProductFromDetails(page, productIds[index]);

    if (index === productIds.length - 1) {
      await productsPage.viewCartFromModal();
    } else {
      await productsPage.continueShopping();
    }
  }
}

export async function addProductFromDetails(page: Page, productId: number, quantity = '1'): Promise<void> {
  await page.goto(`/product_details/${productId}`, { waitUntil: 'domcontentloaded' });
  await addCurrentProductFromDetails(page, quantity);
}

export async function addCurrentProductFromDetails(page: Page, quantity = '1'): Promise<void> {
  await expect(page.locator('.product-information')).toBeVisible();
  await page.locator('#quantity').fill(quantity);
  await expectCartModalScriptReady(page);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.locator('#cartModal')).toBeVisible();
}

export async function expectHtml5ValidationMessage(locator: Locator, message: RegExp): Promise<void> {
  await expect.poll(async () => locator.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => element.validationMessage)).toMatch(message);
}

export async function blockThirdPartyNoiseForContext(context: BrowserContext): Promise<void> {
  await context.route(/.*(googlesyndication|doubleclick|googleadservices|adservice|adsystem|fundingchoices).*/, async (route) => {
    await route.abort();
  });
}

async function expectCartModalScriptReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const maybeWindow = window as typeof window & {
      jQuery?: { fn?: { modal?: unknown } };
    };

    return typeof maybeWindow.jQuery?.fn?.modal === 'function';
  });
}
