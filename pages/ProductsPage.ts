import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectHealthyDemoPage } from './app-navigation';

export class ProductsPage extends BasePage {
  private readonly productCards: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('.features_items .product-image-wrapper');
  }

  async open(): Promise<void> {
    await expect(async () => {
      await this.page.goto('/products', { waitUntil: 'domcontentloaded' });
      await expectHealthyDemoPage(this.page);
      await this.expectAllProductsLoaded();
    }).toPass({ timeout: 20_000 });
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
      await expectHealthyDemoPage(this.page);

      if (!(await searchInput.isVisible().catch(() => false))) {
        await this.page.goto('/products', { waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
      }

      await searchInput.fill(productName);
      await searchButton.click();
      await expectHealthyDemoPage(this.page).catch(async (error: unknown) => {
        await this.page.goto('/products', { waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
        throw error;
      });
      await expect(searchedProductsHeading).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
  }

  async expectSearchResultsFor(productName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /Searched Products/i })).toBeVisible();
    await expect(this.productCards.filter({ hasText: productName }).first()).toBeVisible();
  }

  async openFirstProductDetails(): Promise<void> {
    const productInformation = this.page.locator('.product-information');

    await expect(async () => {
      await expectHealthyDemoPage(this.page);

      if (await productInformation.isVisible().catch(() => false)) {
        return;
      }

      await this.productCards.first().getByRole('link', { name: 'View Product' }).click();
      await expectHealthyDemoPage(this.page).catch(async (error: unknown) => {
        await this.page.goto('/products', { waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
        throw error;
      });
      await expect(this.page).toHaveURL(/\/product_details\/\d+/, { timeout: 3_000 });
      await expect(productInformation).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
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
