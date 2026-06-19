import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectHealthyDemoPage } from './app-navigation';

export class CartPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectCartPage(): Promise<void> {
    await expect(this.page.locator('#cart_info')).toBeVisible();
  }

  async expectProduct(productName: string): Promise<void> {
    await expect(this.page.locator('#cart_info').getByText(productName)).toBeVisible();
  }

  async expectProductQuantity(productName: string, quantity: string): Promise<void> {
    const row = this.page.locator('#cart_info tr').filter({ hasText: productName });
    await expect(row.locator('.cart_quantity')).toHaveText(quantity);
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

    await expect(async () => {
      await expectHealthyDemoPage(this.page);

      if (await checkoutPageHeading.isVisible().catch(() => false)) {
        return;
      }

      if (!(await checkoutButton.isVisible().catch(() => false))) {
        await this.page.goto('/view_cart', { waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
      }

      await expect(checkoutButton).toBeVisible({ timeout: 3_000 });
      await checkoutButton.click();
      await expectHealthyDemoPage(this.page);
      await expect(checkoutPageHeading).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }
}
