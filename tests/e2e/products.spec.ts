import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { reloadDemoPage } from '../../pages/app-navigation';
import { products } from '../../test-data/products';
import { createTestUser } from '../../test-data/user.factory';

async function expectSearchedProductsPage(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Searched Products/i })).toBeVisible();
}

async function expectProductCard(page: Page, productName: string): Promise<void> {
  await expect(page.locator('.features_items .product-image-wrapper').filter({ hasText: productName }).first()).toBeVisible();
}

async function expectNoVisibleProductCards(page: Page): Promise<void> {
  await expect(page.locator('.features_items .product-image-wrapper:visible')).toHaveCount(0);
}

test.describe('Product discovery', () => {
  test('@PROD001 @products @smoke products page lists products and opens product details', async ({ homePage, productsPage, productDetailPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();
    await productsPage.openFirstProductDetails();

    await productDetailPage.expectProductInformation();
  });

  test('@PROD002 @products @regression shopper can search for a product', async ({ homePage, productsPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.searchFor(products.blueTop.name);

    await productsPage.expectSearchResultsFor(products.blueTop.name);
  });

  test('@PROD003 @products @smoke shopper can open product details from search results', async ({ page, productsPage, productDetailPage }) => {
    await productsPage.open();
    await productsPage.searchFor(products.blueTop.name);
    await productsPage.expectSearchResultsFor(products.blueTop.name);

    await productsPage.openFirstProductDetails();

    await productDetailPage.expectProductInformation();
    await expect(page.getByRole('heading', { name: products.blueTop.name })).toBeVisible();
  });

  test('@PROD004 @products @negative search with no matching product shows no product cards', async ({ page, productsPage }) => {
    await productsPage.open();

    await productsPage.searchFor('definitely-not-a-real-product');

    await expectSearchedProductsPage(page);
    await expectNoVisibleProductCards(page);
  });

  test('@PROD005 @products @negative invalid product detail route does not show a valid product identity', async ({ page }) => {
    await page.goto('/product_details/999999', { waitUntil: 'domcontentloaded' });

    const productInformation = page.locator('.product-information');
    await expect(productInformation).toBeVisible();
    await expect(productInformation).not.toContainText(new RegExp(`${products.blueTop.name}|${products.menTshirt.name}|Rs\\.`));
  });

  test('@PROD006 @products @edge partial search returns matching products', async ({ page, productsPage }) => {
    await productsPage.open();

    await productsPage.searchFor('Top');

    await expectSearchedProductsPage(page);
    await expectProductCard(page, products.blueTop.name);
    await expectProductCard(page, products.winterTop.name);
  });

  test('@PROD007 @products @regression visitor can switch between brand product lists', async ({ page, productsPage }) => {
    await productsPage.open();

    await productsPage.filterByBrand('Polo');
    await productsPage.filterByBrand('H&M');
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@PROD008 @products @regression visitor can add a review on a product', async ({ productsPage, productDetailPage }) => {
    const reviewer = createTestUser('review');

    await productsPage.open();
    await productsPage.openFirstProductDetails();

    await productDetailPage.expectReviewFormReady();
    await productDetailPage.fillReview({
      name: reviewer.name,
      email: reviewer.email,
      review: 'This product review validates the review submission workflow.'
    });
    await productDetailPage.submitReview();

    await productDetailPage.expectReviewSubmitted();
  });

  test('@PROD009 @products @negative product review requires an email address', async ({ productsPage, productDetailPage }) => {
    await productsPage.open();
    await productsPage.openFirstProductDetails();

    await productDetailPage.fillReview({
      name: 'Missing Email Reviewer',
      review: 'Email should be required before review submission.'
    });
    await productDetailPage.submitReview();

    await productDetailPage.expectReviewEmailValidationMessage(/fill out this field|required/i);
  });

  test('@PROD010 @products @negative product review requires a valid email address', async ({ productsPage, productDetailPage }) => {
    await productsPage.open();
    await productsPage.openFirstProductDetails();

    await productDetailPage.fillReview({
      name: 'Invalid Email Reviewer',
      email: 'not-an-email',
      review: 'Email format should be validated before review submission.'
    });
    await productDetailPage.submitReview();

    await productDetailPage.expectReviewEmailValidationMessage(/include an '@'|valid email|email address/i);
  });

  test('@PROD011 @products @session products page survives page refresh', async ({ page, productsPage }) => {
    await productsPage.open();

    await reloadDemoPage(page);

    await productsPage.expectAllProductsLoaded();
  });

  test('@PROD012 @products @session products page survives browser back navigation from details', async ({ page, productsPage, productDetailPage }) => {
    await productsPage.open();
    await productsPage.openFirstProductDetails();
    await productDetailPage.expectProductInformation();

    await page.goBack();

    await productsPage.expectAllProductsLoaded();
  });

});
