import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { ProductDetailPage } from '../../pages/ProductDetailPage';
import { actAndVerifyOutcome, becomesVisible, expectHealthyDemoPage, gotoDemoPage } from '../../pages/app-navigation';
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
  await loginPage.loginSuccessfully(user.email, user.password);
  await accountPage.expectLoggedInAs(user.name);
}

// Ends on /login with the session logged out. The header is the session signal: it shows
// "Signup / Login" only to a logged-out visitor, whereas the login heading alone says
// nothing about the session.
export async function logOut(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'Login to your account' });
  const logoutLink = page.getByRole('link', { name: 'Logout' });
  const signupLoginLink = page.getByRole('link', { name: /Signup \/ Login/i });

  await expectHealthyDemoPage(page);
  if ((await loginHeading.isVisible().catch(() => false)) && (await signupLoginLink.isVisible().catch(() => false))) {
    return;
  }

  // Once a logout lands, the Logout link is gone, so replaying the click after a transient
  // error page can only fail on a correct page. A fresh /login shows what actually happened.
  await actAndVerifyOutcome(page, {
    act: async () => {
      await expect(logoutLink).toBeVisible();
      await logoutLink.click();
    },
    confirmation: signupLoginLink,
    verifyOutcome: async () => {
      await gotoDemoPage(page, '/login');
      if (await becomesVisible(signupLoginLink, 2_000)) return 'committed';
      if (await becomesVisible(logoutLink, 2_000)) return 'not-committed';
      return 'unknown';
    },
    operationName: 'Logging out'
  });

  await expect(loginHeading).toBeVisible();
}

export async function deleteAccountIfPresent(page: Page, user: TestUser): Promise<void> {
  const deleteLink = page.getByRole('link', { name: 'Delete Account' });

  if (!(await deleteLink.isVisible().catch(() => false))) {
    const presence = await new LoginPage(page).logInIfAccountExists(user);
    if (presence === 'absent') {
      return;
    }

    if (presence === 'unknown') {
      // Let a transient or bot-challenge page name itself before reporting the stalemate.
      await expectHealthyDemoPage(page);
      throw new Error(`Cleanup could not establish whether the generated account ${user.email} still exists.`);
    }
  }

  await new AccountPage(page).deleteAccount(user);
}

export async function addProductsLeavingCartModalOpen(page: Page, productIds: number[]): Promise<void> {
  const productDetailPage = new ProductDetailPage(page);

  for (let index = 0; index < productIds.length; index += 1) {
    await addProductFromDetails(page, productIds[index]);

    if (index < productIds.length - 1) {
      await productDetailPage.continueShopping();
    }
  }
}

export async function addProductsAndOpenCart(page: Page, productIds: number[]): Promise<void> {
  await addProductsLeavingCartModalOpen(page, productIds);
  await new ProductDetailPage(page).viewCartFromModal();
}

export async function addProductFromDetails(page: Page, productId: number, quantity = '1'): Promise<void> {
  await new ProductDetailPage(page).open(productId);
  await addCurrentProductFromDetails(page, quantity);
}

export async function addCurrentProductFromDetails(page: Page, quantity = '1'): Promise<void> {
  await new ProductDetailPage(page).addCurrentProductToCart(quantity);
}

// Defined under pages/ so page objects can use it without closing an import cycle through
// this module; re-exported here for specs that assert on fields no page object owns yet.
export { expectHtml5ValidationMessage } from '../../pages/html5-validation';

export async function blockThirdPartyNoiseForContext(context: BrowserContext): Promise<void> {
  await blockThirdPartyNoise(context);
}
