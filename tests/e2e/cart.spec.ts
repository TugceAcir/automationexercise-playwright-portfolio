import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { CartPage } from '../../pages/CartPage';
import { ProductsPage } from '../../pages/ProductsPage';
import { createTestUser } from '../../test-data/user.factory';
import { addCurrentProductFromDetails, addProductFromDetails, addProductsToCart, blockThirdPartyNoiseForContext, deleteAccountIfPresent, logInExistingCustomer, logOut, registerCustomer } from '../support/test-actions';

async function expectEmptyCart(page: Page): Promise<void> {
  await expect(page.locator('#empty_cart')).toContainText(/Cart is empty/i);
  await expect(page.locator('#cart_info tr[id^="product-"]')).toHaveCount(0);
}

test.describe('Shopping cart', () => {
  test('@regression shopper can add multiple products to the cart', async ({ homePage, productsPage, cartPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.addProductToCart(1);
    await productsPage.continueShopping();
    await productsPage.addProductToCart(2);
    await productsPage.viewCartFromModal();

    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');
    await cartPage.expectProduct('Men Tshirt');
    await cartPage.expectProductQuantity('Blue Top', '1');
    await cartPage.expectProductQuantity('Men Tshirt', '1');
  });

  test('@regression shopper can remove a product from the cart', async ({ homePage, productsPage, cartPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.addProductToCart(1);
    await productsPage.viewCartFromModal();
    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');

    await cartPage.removeProduct('Blue Top');
  });

  test('@cart @smoke shopper can add a product with a selected quantity', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductFromDetails(page, 1, '4');
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');
    await cartPage.expectProductQuantity('Blue Top', '4');
  });

  test('@cart @negative empty cart does not expose checkout actions', async ({ cartPage, page }) => {
    await page.goto('/view_cart', { waitUntil: 'commit' });

    await cartPage.expectCartPage();
    await expectEmptyCart(page);
    await expect(page.locator('.check_out')).toHaveCount(0);
  });

  test('@cart @edge removing the only product returns the cart to empty state', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsToCart(page, [1]);
    await cartPage.expectProduct('Blue Top');

    await cartPage.removeProduct('Blue Top');

    await expectEmptyCart(page);
  });

  test('@cart @edge adding the same product twice keeps a single line with combined quantity', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsToCart(page, [1, 1]);

    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');
    await cartPage.expectProductQuantity('Blue Top', '2');
  });

  test('@cart @regression visitor can subscribe from the cart page', async ({ page }) => {
    const user = createTestUser('cart-subscription');

    await page.goto('/view_cart', { waitUntil: 'domcontentloaded' });
    await page.locator('#susbscribe_email').scrollIntoViewIfNeeded();
    await page.locator('#susbscribe_email').fill(user.email);
    await page.locator('#subscribe').click();

    await expect(page.getByText('You have been successfully subscribed!')).toBeVisible();
  });

  test('@cart @regression cart shows correct price quantity and line total', async ({ page }) => {
    await addProductFromDetails(page, 1, '4');
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    const row = page.locator('#cart_info tr').filter({ hasText: 'Blue Top' });

    await expect(row.locator('.cart_price')).toContainText('Rs. 500');
    await expect(row.locator('.cart_quantity')).toHaveText('4');
    await expect(row.locator('.cart_total')).toContainText('Rs. 2000');
  });

  test('@cart @regression searched product stays in cart after login', async ({ page }) => {
    const user = createTestUser('cart-after-login');
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);

    try {
      await registerCustomer(page, user);
      await logOut(page);

      await page.goto('/products', { waitUntil: 'domcontentloaded' });
      await productsPage.expectAllProductsLoaded();
      await productsPage.searchFor('Blue Top');
      await productsPage.openFirstProductDetails();
      await addCurrentProductFromDetails(page);
      await productsPage.viewCartFromModal();
      await cartPage.expectProduct('Blue Top');

      await page.getByRole('link', { name: /Signup \/ Login/i }).click();
      await logInExistingCustomer(page, user);
      await page.goto('/view_cart', { waitUntil: 'domcontentloaded' });

      await cartPage.expectProduct('Blue Top');
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@cart @edge visitor can add a recommended item to the cart', async ({ page }) => {
    const cartPage = new CartPage(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /recommended items/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /recommended items/i })).toBeVisible();
    await page.locator('.recommended_items a[data-product-id]').first().click();
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    await cartPage.expectCartPage();
    await expect(page.locator('#cart_info tr[id^="product-"]')).toHaveCount(1);
  });

  test('@cart @session cart contents survive page refresh', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsToCart(page, [1]);

    await page.reload();

    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');
    await cartPage.expectProductQuantity('Blue Top', '1');
  });

  test('@cart @session cart contents survive browser back navigation', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsToCart(page, [1]);
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/products/);

    await page.goBack();

    await cartPage.expectCartPage();
    await cartPage.expectProduct('Blue Top');
  });

  test('@cart @session cart contents can be restored after browser context restart', async ({ browser, page }) => {
    await addProductsToCart(page, [1]);
    const storageState = await page.context().storageState();
    await page.close();

    const restoredContext = await browser.newContext({ storageState });
    await blockThirdPartyNoiseForContext(restoredContext);
    const restoredPage = await restoredContext.newPage();

    try {
      await restoredPage.goto('/view_cart', { waitUntil: 'domcontentloaded' });
      const cartPage = new CartPage(restoredPage);
      await cartPage.expectCartPage();
      await cartPage.expectProduct('Blue Top');
    } finally {
      await restoredContext.close();
    }
  });
});
