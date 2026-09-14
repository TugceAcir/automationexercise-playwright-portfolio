import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndConfirmDemoRequest, actAndExpectHealthyNavigation, becomesVisible, expectHealthyDemoPage, gotoDemoPage } from './app-navigation';

export class CartPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectCartPage(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
    await expectHealthyDemoPage(this.page);
    await expect(this.page.locator('#cart_info')).toBeVisible();
  }

  async expectProduct(productName: string): Promise<void> {
    await expect(this.page.locator('#cart_info').getByText(productName)).toBeVisible();
  }

  async expectProductQuantity(productName: string, quantity: string): Promise<void> {
    const row = this.page.locator('#cart_info tr').filter({ hasText: productName });
    await expect(row.locator('.cart_quantity')).toHaveText(quantity);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.locator('#empty_cart')).toContainText(/Cart is empty/i);
    await expect(this.page.locator('#cart_info tr[id^="product-"]')).toHaveCount(0);
  }

  async expectCheckoutUnavailable(): Promise<void> {
    await expect(this.page.locator('.check_out')).toHaveCount(0);
  }

  async expectProductPricing(productName: string, price: string, quantity: number): Promise<void> {
    const row = this.page.locator('#cart_info tr').filter({ hasText: productName });

    await expect(row.locator('.cart_price')).toContainText(price);
    await expect(row.locator('.cart_quantity')).toHaveText(String(quantity));
    await expect(row.locator('.cart_total')).toContainText(expectedLineTotal(price, quantity));
  }

  async removeProduct(productName: string): Promise<void> {
    const row = this.page.locator('#cart_info tr').filter({ hasText: productName });
    const removeButton = row.locator('a.cart_quantity_delete');

    await expect(removeButton).toBeVisible();
    await expect(async () => {
      await removeButton.click();
      await expect(row).toHaveCount(0, { timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }

  async proceedToCheckout(): Promise<void> {
    const checkoutButton = this.page.locator('.check_out').filter({ hasText: 'Proceed To Checkout' });
    const checkoutPageHeading = this.page.getByRole('heading', { name: 'Address Details' });

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(checkoutButton).toBeVisible();
        await this.expectCartModalScriptReady();
        await actAndConfirmDemoRequest(this.page, {
          act: async () => checkoutButton.click(),
          requestMatches: (request) => new URL(request.url()).pathname === '/checkout',
          operationName: 'Proceeding to checkout',
          // Proceeding navigates to /checkout, so a missed or unanswered request must not
          // replay the click against a page that has already moved on.
          isCommitted: async () => /\/checkout/.test(this.page.url()) && (await becomesVisible(checkoutPageHeading, 2_000))
        });
      },
      expectReady: async () => {
        await expect(this.page).toHaveURL(/\/checkout/);
        await expect(checkoutPageHeading).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/view_cart');
      }
    });
  }
}

// The demo site renders a line total as price x quantity. Deriving it here keeps the
// arithmetic in the page object that owns the cart, so a spec asserts behaviour rather
// than recomputing the site's maths inline.
function expectedLineTotal(price: string, quantity: number): string {
  const numericPrice = Number(price.replace(/[^\d.]/g, ''));

  if (!Number.isFinite(numericPrice)) {
    throw new Error(`Cannot calculate cart total from price: ${price}`);
  }

  return `Rs. ${numericPrice * quantity}`;
}
