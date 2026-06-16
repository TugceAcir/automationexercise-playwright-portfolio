import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductsPage extends BasePage {
  private readonly productCards: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('.features_items .product-image-wrapper');
  }

  async expectAllProductsLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /All Products/i })).toBeVisible();
    await expect(this.productCards.first()).toBeVisible();
  }

  async searchFor(productName: string): Promise<void> {
    const searchInput = this.page.locator('#search_product');
    const searchButton = this.page.locator('#submit_search');
    const searchedProductsHeading = this.page.getByRole('heading', { name: /Searched Products/i });

    await expect(async () => {
      await searchInput.fill(productName);
      await searchButton.click();
      await expect(searchedProductsHeading).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }

  async expectSearchResultsFor(productName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /Searched Products/i })).toBeVisible();
    await expect(this.productCards.filter({ hasText: productName }).first()).toBeVisible();
  }

  async openFirstProductDetails(): Promise<void> {
    await this.productCards.first().getByRole('link', { name: 'View Product' }).click();
  }

  async expectProductDetails(): Promise<void> {
    const productInformation = this.page.locator('.product-information');
    await expect(productInformation).toContainText('Category:');
    await expect(productInformation).toContainText('Availability:');
    await expect(productInformation).toContainText('Condition:');
    await expect(productInformation).toContainText('Brand:');
  }

  async addProductToCart(productId: number): Promise<void> {
    const productCard = this.page.locator('.product-image-wrapper').filter({
      has: this.page.locator(`a[data-product-id="${productId}"]`)
    }).first();
    const addToCart = productCard.locator('.productinfo a[data-product-id]').first();
    const cartModal = this.page.locator('#cartModal');

    await productCard.scrollIntoViewIfNeeded();
    await productCard.hover();
    await expect(addToCart).toBeVisible();
    await this.expectCartModalScriptReady();
    await expect(async () => {
      await addToCart.click();
      await expect(cartModal).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 15_000 });
  }
}
