import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndExpectHealthyNavigation, gotoDemoPage } from './app-navigation';

export class ProductsPage extends BasePage {
  private readonly productCards: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.locator('.features_items .product-image-wrapper');
  }

  async open(): Promise<void> {
    await this.goto('/products');
    await this.expectAllProductsLoaded();
  }

  async expectAllProductsLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /All Products/i })).toBeVisible();
    await expect(this.productCards.first()).toBeVisible();
  }

  async searchFor(productName: string): Promise<void> {
    const searchInput = this.page.locator('#search_product');
    const searchButton = this.page.locator('#submit_search');
    const searchedProductsHeading = this.page.getByRole('heading', { name: /Searched Products/i });

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(searchInput).toBeVisible();
        await expect(searchButton).toBeVisible();
        await searchInput.fill(productName);
        await searchButton.click();
      },
      expectReady: async () => {
        await expect(searchedProductsHeading).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/products');
      }
    });
  }

  async expectSearchResultsFor(productName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /Searched Products/i })).toBeVisible();
    await expect(this.productCards.filter({ hasText: productName }).first()).toBeVisible();
  }

  async openFirstProductDetails(): Promise<void> {
    const viewProductLink = this.productCards.first().getByRole('link', { name: 'View Product' });
    const productInformation = this.page.locator('.product-information');

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(viewProductLink).toBeVisible();
        await viewProductLink.click();
      },
      expectReady: async () => {
        await expect(this.page).toHaveURL(/\/product_details\/\d+/);
        await expect(productInformation).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/products');
      }
    });
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
