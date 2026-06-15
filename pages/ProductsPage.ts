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

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await searchInput.fill(productName);
      await searchButton.click();

      if (await searchedProductsHeading.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }

      await searchButton.evaluate((element) => {
        (element as HTMLElement).click();
      });

      if (await searchedProductsHeading.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }
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
    const addToCart = this.page.locator(`a[data-product-id="${productId}"]`).first();
    const cartModal = this.page.locator('#cartModal');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await addToCart.scrollIntoViewIfNeeded();
      await addToCart.click();

      if (await cartModal.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }

      await addToCart.evaluate((element) => {
        (element as HTMLElement).click();
      });

      if (await cartModal.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }

    await expect(cartModal).toBeVisible();
  }

  async continueShopping(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continue Shopping' }).click();
  }

  async viewCartFromModal(): Promise<void> {
    await this.page.locator('#cartModal').getByRole('link', { name: 'View Cart' }).click();
  }
}
