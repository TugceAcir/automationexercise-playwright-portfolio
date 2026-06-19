import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { CartPage } from '../../pages/CartPage';
import { ProductsPage } from '../../pages/ProductsPage';
import { expectHealthyDemoPage, gotoDemoPage, reloadDemoPage } from '../../pages/app-navigation';
import { products } from '../../test-data/products';
import { createTestUser } from '../../test-data/user.factory';
import { addCurrentProductFromDetails, addProductFromDetails, addProductsAndOpenCart, blockThirdPartyNoiseForContext, deleteAccountIfPresent, logInExistingCustomer, logOut, registerCustomer } from '../support/test-actions';

async function expectEmptyCart(page: Page): Promise<void> {
  await expect(page.locator('#empty_cart')).toContainText(/Cart is empty/i);
  await expect(page.locator('#cart_info tr[id^="product-"]')).toHaveCount(0);
}

function expectedLineTotal(price: string, quantity: number): string {
  const numericPrice = Number(price.replace(/[^\d.]/g, ''));

  if (!Number.isFinite(numericPrice)) {
    throw new Error(`Cannot calculate cart total from price: ${price}`);
  }

  return `Rs. ${numericPrice * quantity}`;
}

test.describe('Shopping cart', () => {
  test('@CART001 @cart @regression shopper can add multiple products to the cart', async ({ homePage, productsPage, cartPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.addProductToCart(products.blueTop.id);
    await productsPage.continueShopping();
    await productsPage.addProductToCart(products.menTshirt.id);
    await productsPage.viewCartFromModal();

    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);
    await cartPage.expectProduct(products.menTshirt.name);
    await cartPage.expectProductQuantity(products.blueTop.name, '1');
    await cartPage.expectProductQuantity(products.menTshirt.name, '1');
  });

  test('@CART002 @cart @regression shopper can remove a product from the cart', async ({ homePage, productsPage, cartPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.addProductToCart(products.blueTop.id);
    await productsPage.viewCartFromModal();
    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);

    await cartPage.removeProduct(products.blueTop.name);
  });

  test('@CART003 @cart @smoke shopper can add a product with a selected quantity', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductFromDetails(page, products.blueTop.id, '4');
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);
    await cartPage.expectProductQuantity(products.blueTop.name, '4');
  });

  test('@CART004 @cart @negative empty cart does not expose checkout actions', async ({ cartPage, page }) => {
    await gotoDemoPage(page, '/view_cart');

    await cartPage.expectCartPage();
    await expectEmptyCart(page);
    await expect(page.locator('.check_out')).toHaveCount(0);
  });

  test('@CART005 @cart @edge removing the only product returns the cart to empty state', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsAndOpenCart(page, [products.blueTop.id]);
    await cartPage.expectProduct(products.blueTop.name);

    await cartPage.removeProduct(products.blueTop.name);

    await expectEmptyCart(page);
  });

  test('@CART006 @cart @edge adding the same product twice keeps a single line with combined quantity', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsAndOpenCart(page, [products.blueTop.id, products.blueTop.id]);

    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);
    await cartPage.expectProductQuantity(products.blueTop.name, '2');
  });

  test('@CART007 @cart @regression visitor can subscribe from the cart page', async ({ page }) => {
    const user = createTestUser('cart-subscription');

    await gotoDemoPage(page, '/view_cart');
    await page.locator('#susbscribe_email').scrollIntoViewIfNeeded();
    await page.locator('#susbscribe_email').fill(user.email);
    await page.locator('#subscribe').click();

    await expect(page.getByText('You have been successfully subscribed!')).toBeVisible();
  });

  test('@CART008 @cart @regression cart shows correct price quantity and line total', async ({ page }) => {
    const quantity = 4;

    await addProductFromDetails(page, products.blueTop.id, String(quantity));
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    const row = page.locator('#cart_info tr').filter({ hasText: products.blueTop.name });

    await expect(row.locator('.cart_price')).toContainText(products.blueTop.price);
    await expect(row.locator('.cart_quantity')).toHaveText(String(quantity));
    await expect(row.locator('.cart_total')).toContainText(expectedLineTotal(products.blueTop.price, quantity));
  });

  test('@CART009 @cart @regression searched product stays in cart after login', async ({ page }) => {
    const user = createTestUser('cart-after-login');
    const productsPage = new ProductsPage(page);
    const cartPage = new CartPage(page);

    try {
      await registerCustomer(page, user);
      await logOut(page);

      await productsPage.open();
      await productsPage.searchFor(products.blueTop.name);
      await productsPage.openFirstProductDetails();
      await addCurrentProductFromDetails(page);
      await productsPage.viewCartFromModal();
      await cartPage.expectProduct(products.blueTop.name);

      await page.getByRole('link', { name: /Signup \/ Login/i }).click();
      await logInExistingCustomer(page, user);
      await gotoDemoPage(page, '/view_cart');

      await cartPage.expectProduct(products.blueTop.name);
    } finally {
      await deleteAccountIfPresent(page);
    }
  });

  test('@CART010 @cart @edge visitor can add a recommended item to the cart', async ({ page }) => {
    const cartPage = new CartPage(page);

    await gotoDemoPage(page, '/');
    await page.getByRole('heading', { name: /recommended items/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /recommended items/i })).toBeVisible();
    await page.locator('.recommended_items a[data-product-id]').first().click();
    await page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();

    await cartPage.expectCartPage();
    await expect(page.locator('#cart_info tr[id^="product-"]')).toHaveCount(1);
  });

  test('@CART011 @cart @session cart contents survive page refresh', async ({ page }) => {
    const cartPage = new CartPage(page);

    await addProductsAndOpenCart(page, [products.blueTop.id]);

    await reloadDemoPage(page);

    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);
    await cartPage.expectProductQuantity(products.blueTop.name, '1');
  });

  test('@CART012 @cart @session cart contents survive browser back navigation', async ({ page }) => {
    const cartPage = new CartPage(page);
    const productsPage = new ProductsPage(page);

    await addProductsAndOpenCart(page, [products.blueTop.id]);
    await productsPage.open();
    await expect(page).toHaveURL(/\/products/);

    await page.goBack();

    await expect(async () => {
      await expectHealthyDemoPage(page).catch(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(page);
      });
      await cartPage.expectCartPage();
      await cartPage.expectProduct(products.blueTop.name);
    }).toPass({ timeout: 45_000 });
  });

  test('@CART013 @cart @session cart contents can be restored after browser context restart', async ({ browser, page }) => {
    await addProductsAndOpenCart(page, [products.blueTop.id]);
    const storageState = await page.context().storageState();
    await page.close();

    const restoredContext = await browser.newContext({ storageState });
    await blockThirdPartyNoiseForContext(restoredContext);
    const restoredPage = await restoredContext.newPage();

    try {
      await gotoDemoPage(restoredPage, '/view_cart');
      const cartPage = new CartPage(restoredPage);
      await cartPage.expectCartPage();
      await cartPage.expectProduct(products.blueTop.name);
    } finally {
      await restoredContext.close();
    }
  });
});
