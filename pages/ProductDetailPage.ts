import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(productId: number): Promise<void> {
    await this.goto(`/product_details/${productId}`);
    await this.expectProductInformation();
  }

  async expectProductInformation(): Promise<void> {
    const productInformation = this.page.locator('.product-information');

    await expect(productInformation).toBeVisible();
    await expect(productInformation).toContainText('Category:');
    await expect(productInformation).toContainText('Availability:');
    await expect(productInformation).toContainText('Condition:');
    await expect(productInformation).toContainText('Brand:');
  }

  async addCurrentProductToCart(quantity = '1'): Promise<void> {
    await this.expectProductInformation();
    await this.page.locator('#quantity').fill(quantity);
    await this.expectCartModalScriptReady();
    await expect(async () => {
      await this.page.getByRole('button', { name: 'Add to cart' }).click();
      await expect(this.page.locator('#cartModal')).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }
}
