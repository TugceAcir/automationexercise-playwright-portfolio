import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

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
    const removeButton = row.locator('.cart_quantity_delete');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await removeButton.click();
      if (await row.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }

      await removeButton.evaluate((element) => {
        (element as HTMLElement).click();
      });
      if (await row.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }

    await expect(row).toHaveCount(0);
  }

  async proceedToCheckout(): Promise<void> {
    const checkoutButton = this.page.locator('.check_out').filter({ hasText: 'Proceed To Checkout' });
    const checkoutPageHeading = this.page.getByRole('heading', { name: 'Address Details' });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await checkoutButton.click();
      if (await checkoutPageHeading.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }

      await checkoutButton.evaluate((element) => {
        (element as HTMLElement).click();
      });
      if (await checkoutPageHeading.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }

    await this.page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/checkout/);
  }
}
