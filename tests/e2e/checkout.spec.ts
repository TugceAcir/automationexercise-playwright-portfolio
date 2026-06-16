import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { AccountPage } from '../../pages/AccountPage';
import { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { LoginPage } from '../../pages/LoginPage';
import { testPayment } from '../../test-data/payment.factory';
import { products } from '../../test-data/products';
import { createTestUser } from '../../test-data/user.factory';
import type { TestUser } from '../../test-data/user.factory';
import { addProductsAndOpenCart, blockThirdPartyNoiseForContext, deleteAccountIfPresent, expectHtml5ValidationMessage, registerCustomer } from '../support/test-actions';

async function startRegisteredCheckout(page: Page, user: TestUser, productIds: number[] = [products.blueTop.id]): Promise<void> {
  await registerCustomer(page, user);
  await addProductsAndOpenCart(page, productIds);
  await new CartPage(page).proceedToCheckout();
  await new CheckoutPage(page).expectAddressAndOrderReview();
}

async function expectGuestCheckoutPrompt(page: Page): Promise<void> {
  const checkoutButton = page.locator('.check_out').filter({ hasText: 'Proceed To Checkout' });
  const checkoutModal = page.locator('#checkoutModal');

  await expect(checkoutButton).toBeVisible();
  await expect(async () => {
    await checkoutButton.click();
    await expect(checkoutModal).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });
  await expect(checkoutModal.getByText(/Register \/ Login account to proceed on checkout/i)).toBeVisible();
  await expect(checkoutModal.getByRole('link', { name: 'Register / Login' })).toBeVisible();
}

async function expectCheckoutAddressesMatchUser(page: Page, user: TestUser): Promise<void> {
  const deliveryAddress = page.locator('#address_delivery');
  const billingAddress = page.locator('#address_invoice');
  const expectedAddressParts = [
    user.firstName,
    user.lastName,
    user.company,
    user.address1,
    user.address2,
    user.city,
    user.state,
    user.zipCode,
    user.country,
    user.mobileNumber
  ];

  for (const address of [deliveryAddress, billingAddress]) {
    for (const part of expectedAddressParts) {
      await expect(address).toContainText(part);
    }
  }
}

test.describe('Checkout', () => {
  test('@CHECKOUT001 @checkout @regression registered shopper can place an order', async ({
    accountPage,
    cartPage,
    checkoutPage,
    homePage,
    loginPage,
    page,
    productsPage
  }) => {
    const user = createTestUser('checkout');

    try {
      await homePage.open();
      await homePage.navigateToSignupLogin();
      await loginPage.startSignup(user);
      await loginPage.completeAccountInformation(user);
      await accountPage.expectAccountCreated();
      await accountPage.continueAfterAccountCreated();
      await accountPage.expectLoggedInAs(user.name);

      await homePage.navigateToProducts();
      await productsPage.addProductToCart(1);
      await productsPage.viewCartFromModal();
      await cartPage.expectCartPage();
      await cartPage.proceedToCheckout();

      await checkoutPage.expectAddressAndOrderReview();
      await checkoutPage.placeOrder('Please deliver this portfolio-quality order carefully.');
      await checkoutPage.pay(testPayment);
      await checkoutPage.expectOrderPlaced();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT002 @checkout @smoke registered shopper can review multiple products before placing an order', async ({ page }) => {
    const user = createTestUser('checkout-review');
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    try {
      await startRegisteredCheckout(page, user, [products.blueTop.id, products.menTshirt.id]);

      await cartPage.expectProduct(products.blueTop.name);
      await cartPage.expectProduct(products.menTshirt.name);
      await checkoutPage.placeOrder('Please pack the two checkout items together.');
      await expect(page).toHaveURL(/\/payment/);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT003 @checkout @negative guest shopper is asked to register or log in before checkout', async ({ page }) => {
    await addProductsAndOpenCart(page, [products.blueTop.id]);

    await expectGuestCheckoutPrompt(page);
  });

  test('@CHECKOUT004 @checkout @regression shopper can register during checkout and place an order', async ({ page }) => {
    const user = createTestUser('checkout-register-during');
    const loginPage = new LoginPage(page);
    const accountPage = new AccountPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    try {
      await addProductsAndOpenCart(page, [products.blueTop.id]);
      await expectGuestCheckoutPrompt(page);
      await page.locator('#checkoutModal').getByRole('link', { name: 'Register / Login' }).click();
      await loginPage.startSignup(user);
      await loginPage.completeAccountInformation(user);
      await accountPage.expectAccountCreated();
      await accountPage.continueAfterAccountCreated();
      await accountPage.expectLoggedInAs(user.name);

      await page.goto('/view_cart', { waitUntil: 'domcontentloaded' });
      await cartPage.proceedToCheckout();
      await checkoutPage.expectAddressAndOrderReview();
      await checkoutPage.placeOrder('Registering during checkout should preserve the cart.');
      await checkoutPage.pay(testPayment);

      await checkoutPage.expectOrderPlaced();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT005 @checkout @regression shopper can log in before checkout and place an order', async ({ page }) => {
    const user = createTestUser('checkout-login-before');
    const checkoutPage = new CheckoutPage(page);

    try {
      await registerCustomer(page, user);
      await page.getByRole('link', { name: 'Logout' }).click();
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await new LoginPage(page).login(user.email, user.password);
      await new AccountPage(page).expectLoggedInAs(user.name);
      await addProductsAndOpenCart(page, [products.blueTop.id]);
      await new CartPage(page).proceedToCheckout();
      await checkoutPage.expectAddressAndOrderReview();
      await checkoutPage.placeOrder('Logging in before checkout should allow payment.');
      await checkoutPage.pay(testPayment);

      await checkoutPage.expectOrderPlaced();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT006 @checkout @negative payment requires cardholder details', async ({ page }) => {
    const user = createTestUser('checkout-payment-required');
    const checkoutPage = new CheckoutPage(page);

    try {
      await startRegisteredCheckout(page, user);
      await checkoutPage.placeOrder('Payment validation check.');

      await page.locator('[data-qa="pay-button"]').click();

      await expectHtml5ValidationMessage(page.locator('[data-qa="name-on-card"]'), /fill out this field|required/i);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT007 @checkout @edge checkout accepts a long order comment', async ({ page }) => {
    const user = createTestUser('checkout-comment');
    const checkoutPage = new CheckoutPage(page);
    const longComment = `Delivery note: ${'Please handle this order carefully. '.repeat(20)}`;

    try {
      await startRegisteredCheckout(page, user);

      await checkoutPage.placeOrder(longComment);

      await expect(page).toHaveURL(/\/payment/);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT008 @checkout @regression checkout delivery and billing addresses match registration data', async ({ page }) => {
    const user = createTestUser('checkout-address');

    try {
      await startRegisteredCheckout(page, user);

      await expectCheckoutAddressesMatchUser(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT009 @checkout @regression shopper can download invoice after purchase', async ({ page }) => {
    const user = createTestUser('checkout-invoice');
    const checkoutPage = new CheckoutPage(page);

    try {
      await startRegisteredCheckout(page, user);
      await checkoutPage.placeOrder('Please include invoice verification.');
      await checkoutPage.pay(testPayment);
      await checkoutPage.expectOrderPlaced();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: /Download Invoice/i }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/invoice/i);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT010 @checkout @session checkout page survives page refresh', async ({ page }) => {
    const user = createTestUser('checkout-refresh');
    const checkoutPage = new CheckoutPage(page);

    try {
      await startRegisteredCheckout(page, user);

      await page.reload();

      await checkoutPage.expectAddressAndOrderReview();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT011 @checkout @session checkout page survives browser back navigation from payment', async ({ page }) => {
    const user = createTestUser('checkout-back');
    const checkoutPage = new CheckoutPage(page);

    try {
      await startRegisteredCheckout(page, user);
      await checkoutPage.placeOrder('Checking browser back behavior from payment.');
      await expect(page).toHaveURL(/\/payment/);

      await page.goBack();

      await checkoutPage.expectAddressAndOrderReview();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT012 @checkout @session checkout state can be restored after browser context restart', async ({ browser, page }) => {
    const user = createTestUser('checkout-browser-close');

    await startRegisteredCheckout(page, user);
    const storageState = await page.context().storageState();
    await page.close();

    const restoredContext = await browser.newContext({ storageState });
    await blockThirdPartyNoiseForContext(restoredContext);
    const restoredPage = await restoredContext.newPage();

    try {
      await restoredPage.goto('/checkout', { waitUntil: 'domcontentloaded' });
      await new CheckoutPage(restoredPage).expectAddressAndOrderReview();
    } finally {
      await deleteAccountIfPresent(restoredPage);
      await restoredContext.close();
    }
  });
});
