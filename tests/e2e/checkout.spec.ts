import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import type { CartPage } from '../../pages/CartPage';
import { CheckoutPage } from '../../pages/CheckoutPage';
import { actAndExpectHealthyNavigation, expectHealthyDemoPage, gotoDemoPage, reloadDemoPage } from '../../pages/app-navigation';
import { testPayment } from '../../test-data/payment.factory';
import { products } from '../../test-data/products';
import { createTestUser } from '../../test-data/user.factory';
import type { TestUser } from '../../test-data/user.factory';
import { addProductsAndOpenCart, blockThirdPartyNoiseForContext, deleteAccountIfPresent, expectHtml5ValidationMessage, logInExistingCustomer, logOut, registerCustomer } from '../support/test-actions';

async function startRegisteredCheckout(
  page: Page,
  user: TestUser,
  cartPage: CartPage,
  checkoutPage: CheckoutPage,
  productIds: number[] = [products.blueTop.id]
): Promise<void> {
  await registerCustomer(page, user);
  await addProductsAndOpenCart(page, productIds);
  await cartPage.proceedToCheckout();
  await checkoutPage.expectAddressAndOrderReview();
}

async function expectGuestCheckoutPrompt(page: Page): Promise<void> {
  const checkoutButton = page.locator('.check_out').filter({ hasText: 'Proceed To Checkout' });
  const checkoutModal = page.locator('#checkoutModal');
  const promptText = checkoutModal.getByText(/Register \/ Login account to proceed on checkout/i);
  const registerLoginLink = checkoutModal.getByRole('link', { name: 'Register / Login' });

  await actAndExpectHealthyNavigation(page, {
    act: async () => {
      await expect(checkoutButton).toBeVisible();
      await expectBootstrapModalReady(page);
      await checkoutButton.click();
    },
    expectReady: async () => {
      await expect(checkoutModal).toBeVisible();
      await expect(promptText).toBeVisible();
      await expect(registerLoginLink).toBeVisible();
    },
    recover: async () => {
      await gotoDemoPage(page, '/view_cart');
    }
  });
}

async function chooseRegisterLoginFromCheckoutPrompt(page: Page): Promise<void> {
  const checkoutButton = page.locator('.check_out').filter({ hasText: 'Proceed To Checkout' });
  const checkoutModal = page.locator('#checkoutModal');
  const promptText = checkoutModal.getByText(/Register \/ Login account to proceed on checkout/i);
  const registerLoginLink = checkoutModal.getByRole('link', { name: 'Register / Login' });

  if (!(await registerLoginLink.isVisible().catch(() => false))) {
    await actAndExpectHealthyNavigation(page, {
      act: async () => {
        await expect(checkoutButton).toBeVisible();
        await expectBootstrapModalReady(page);
        await checkoutButton.click();
      },
      expectReady: async () => {
        await expect(checkoutModal).toBeVisible();
        await expect(promptText).toBeVisible();
        await expect(registerLoginLink).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(page, '/view_cart');
      }
    });
  }

  await expect(checkoutModal).toBeVisible();
  await expect(promptText).toBeVisible();
  await expect(registerLoginLink).toBeVisible();
  await registerLoginLink.click();
  await expectHealthyDemoPage(page);
  await expect(page).toHaveURL(/\/login/);
}

async function expectBootstrapModalReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const maybeWindow = window as typeof window & {
      jQuery?: { fn?: { modal?: unknown } };
    };

    return typeof maybeWindow.jQuery?.fn?.modal === 'function';
  });
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

  test('@CHECKOUT002 @checkout @smoke registered shopper can review multiple products before placing an order', async ({
    cartPage,
    checkoutPage,
    page
  }) => {
    const user = createTestUser('checkout-review');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage, [products.blueTop.id, products.menTshirt.id]);

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

  test('@CHECKOUT004 @checkout @regression shopper can register during checkout and place an order', async ({
    accountPage,
    cartPage,
    checkoutPage,
    loginPage,
    page
  }) => {
    const user = createTestUser('checkout-register-during');

    try {
      await addProductsAndOpenCart(page, [products.blueTop.id]);
      await expectGuestCheckoutPrompt(page);
      await chooseRegisterLoginFromCheckoutPrompt(page);
      await loginPage.startSignup(user);
      await loginPage.completeAccountInformation(user);
      await accountPage.expectAccountCreated();
      await accountPage.continueAfterAccountCreated();
      await accountPage.expectLoggedInAs(user.name);

      await gotoDemoPage(page, '/view_cart');
      await cartPage.expectCartPage();
      await cartPage.expectProduct(products.blueTop.name);
      await cartPage.proceedToCheckout();
      await checkoutPage.expectAddressAndOrderReview();
      await checkoutPage.placeOrder('Registering during checkout should preserve the cart.');
      await checkoutPage.pay(testPayment);

      await checkoutPage.expectOrderPlaced();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT005 @checkout @regression shopper can log in before checkout and place an order', async ({
    cartPage,
    checkoutPage,
    page
  }) => {
    const user = createTestUser('checkout-login-before');

    try {
      await registerCustomer(page, user);
      await logOut(page);
      await logInExistingCustomer(page, user);
      await addProductsAndOpenCart(page, [products.blueTop.id]);
      await cartPage.proceedToCheckout();
      await checkoutPage.expectAddressAndOrderReview();
      await checkoutPage.placeOrder('Logging in before checkout should allow payment.');
      await checkoutPage.pay(testPayment);

      await checkoutPage.expectOrderPlaced();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT006 @checkout @negative payment requires cardholder details', async ({ cartPage, checkoutPage, page }) => {
    const user = createTestUser('checkout-payment-required');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);
      await checkoutPage.placeOrder('Payment validation check.');

      await page.locator('[data-qa="pay-button"]').click();

      await expectHtml5ValidationMessage(page.locator('[data-qa="name-on-card"]'), /fill out this field|required/i);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT007 @checkout @edge checkout accepts a long order comment', async ({ cartPage, checkoutPage, page }) => {
    const user = createTestUser('checkout-comment');
    const longComment = `Delivery note: ${'Please handle this order carefully. '.repeat(20)}`;

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);

      await checkoutPage.placeOrder(longComment);

      await expect(page).toHaveURL(/\/payment/);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT008 @checkout @regression checkout delivery and billing addresses match registration data', async ({
    cartPage,
    checkoutPage,
    page
  }) => {
    const user = createTestUser('checkout-address');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);

      await expectCheckoutAddressesMatchUser(page, user);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT009 @checkout @regression shopper can download invoice after purchase', async ({ cartPage, checkoutPage, page }) => {
    const user = createTestUser('checkout-invoice');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);
      await checkoutPage.placeOrder('Please include invoice verification.');
      await checkoutPage.pay(testPayment);
      await checkoutPage.expectOrderPlaced();

      const download = await checkoutPage.downloadInvoice();

      expect(download.suggestedFilename()).toMatch(/invoice/i);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT010 @checkout @session checkout page survives page refresh', async ({ cartPage, checkoutPage, page }) => {
    const user = createTestUser('checkout-refresh');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);

      await reloadDemoPage(page);

      await checkoutPage.expectAddressAndOrderReview();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT011 @checkout @session checkout page survives browser back navigation from payment', async ({
    cartPage,
    checkoutPage,
    page
  }) => {
    const user = createTestUser('checkout-back');

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);
      await checkoutPage.placeOrder('Checking browser back behavior from payment.');
      await expect(page).toHaveURL(/\/payment/);

      await page.goBack();

      await expectHealthyDemoPage(page);
      await checkoutPage.expectAddressAndOrderReview();
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CHECKOUT012 @checkout @session checkout state can be restored after browser context restart', async ({
    browser,
    cartPage,
    checkoutPage,
    page
  }) => {
    const user = createTestUser('checkout-browser-close');
    let restoredContext: BrowserContext | undefined;
    let cleanupPage: Page = page;

    try {
      await startRegisteredCheckout(page, user, cartPage, checkoutPage);
      const storageState = await page.context().storageState();

      restoredContext = await browser.newContext({ storageState });
      await blockThirdPartyNoiseForContext(restoredContext);
      const restoredPage = await restoredContext.newPage();
      cleanupPage = restoredPage;
      await page.close();

      await gotoDemoPage(restoredPage, '/checkout');
      await new CheckoutPage(restoredPage).expectAddressAndOrderReview();
    } finally {
      try {
        await deleteAccountIfPresent(cleanupPage);
      } finally {
        await restoredContext?.close();

        if (!page.isClosed()) {
          await page.close();
        }
      }
    }
  });
});
