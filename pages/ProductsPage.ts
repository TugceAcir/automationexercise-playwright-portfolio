import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndConfirmDemoRequest, actAndExpectHealthyNavigation, gotoDemoPage } from './app-navigation';

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

  async filterByBrand(brandName: string): Promise<void> {
    const brandLink = this.page.locator(`a[href="/brand_products/${brandName}"]`);
    const escapedBrandName = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('&', '(?:&|%26)');
    const brandHeading = this.page.getByRole('heading', { name: new RegExp(`Brand - ${brandName} Products`, 'i') });

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(brandLink).toBeVisible();
        await brandLink.click();
      },
      expectReady: async () => {
        await expect(this.page).toHaveURL(new RegExp(`/brand_products/${escapedBrandName}$`));
        await expect(brandHeading).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/products');
      },
      retryOnNavigationTimeout: true
    });
  }

  async openFirstProductDetails(): Promise<void> {
    const viewProductLink = this.productCards.first().getByRole('link', { name: 'View Product' });
    const productInformation = this.page.locator('.product-information');

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(viewProductLink).toBeVisible();
        await expect(viewProductLink).toHaveAttribute('href', /\/product_details\/\d+/);
        await actAndConfirmDemoRequest(this.page, {
          act: async () => viewProductLink.click(),
          requestMatches: (request) => /\/product_details\/\d+/.test(new URL(request.url()).pathname),
          operationName: 'Opening product details'
        });
      },
      expectReady: async () => {
        await expect(this.page).toHaveURL(/\/product_details\/\d+/);
        await expect(productInformation).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/products');
      },
      retryOnNavigationTimeout: true
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
    const addToCart = productCard.locator('.product-overlay a[data-product-id]').first();

    await productCard.scrollIntoViewIfNeeded();
    await productCard.hover();
    await expect(addToCart).toBeVisible();
    await this.expectCartModalScriptReady();

    await actAndConfirmDemoRequest(this.page, {
      act: async () => addToCart.click(),
      requestMatches: (request) => new URL(request.url()).pathname === `/add_to_cart/${productId}`,
      operationName: `Adding product ${productId} to the cart`,
      retryServerError: true
    });
    await this.expectCartModalVisible();
  }
}
