import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { ProductsPage } from '../../pages/ProductsPage';
import { expectHtml5ValidationMessage } from '../support/test-actions';

async function openProductsPage(page: Page): Promise<ProductsPage> {
  const productsPage = new ProductsPage(page);
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await productsPage.expectAllProductsLoaded();
  return productsPage;
}

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
  test('@smoke products page lists products and opens product details', async ({ homePage, productsPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();
    await productsPage.openFirstProductDetails();

    await productsPage.expectProductDetails();
  });

  test('@regression shopper can search for a product', async ({ homePage, productsPage }) => {
    await homePage.open();
    await homePage.navigateToProducts();
    await productsPage.expectAllProductsLoaded();

    await productsPage.searchFor('Blue Top');

    await productsPage.expectSearchResultsFor('Blue Top');
  });

  test('@products @smoke shopper can open product details from search results', async ({ page }) => {
    const productsPage = await openProductsPage(page);
    await productsPage.searchFor('Blue Top');
    await productsPage.expectSearchResultsFor('Blue Top');

    await productsPage.openFirstProductDetails();

    await productsPage.expectProductDetails();
    await expect(page.getByRole('heading', { name: 'Blue Top' })).toBeVisible();
  });

  test('@products @negative search with no matching product shows no product cards', async ({ page }) => {
    const productsPage = await openProductsPage(page);

    await productsPage.searchFor('definitely-not-a-real-product');

    await expectSearchedProductsPage(page);
    await expectNoVisibleProductCards(page);
  });

  test('@products @negative invalid product detail route does not show a valid product identity', async ({ page }) => {
    await page.goto('/product_details/999999', { waitUntil: 'domcontentloaded' });

    const productInformation = page.locator('.product-information');
    await expect(productInformation).toBeVisible();
    await expect(productInformation.locator('h2')).toHaveText('');
    await expect(productInformation).not.toContainText(/Blue Top|Men Tshirt|Rs\./);
  });

  test('@products @edge partial search returns matching products', async ({ page }) => {
    const productsPage = await openProductsPage(page);

    await productsPage.searchFor('Top');

    await expectSearchedProductsPage(page);
    await expectProductCard(page, 'Blue Top');
    await expectProductCard(page, 'Winter Top');
  });

  test('@products @regression visitor can switch between brand product lists', async ({ page }) => {
    await openProductsPage(page);

    await page.getByRole('link', { name: /Polo/i }).click();
    await expect(page.getByRole('heading', { name: /Brand - Polo Products/i })).toBeVisible();

    await page.getByRole('link', { name: /H&M/i }).click();

    await expect(page.getByRole('heading', { name: /Brand - H&M Products/i })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@products @regression visitor can add a review on a product', async ({ page }) => {
    const productsPage = await openProductsPage(page);
    await productsPage.openFirstProductDetails();

    await expect(page.getByRole('link', { name: /Write Your Review/i })).toBeVisible();
    await page.locator('#name').fill('Review Visitor');
    await page.locator('#email').fill('review.visitor@example.com');
    await page.locator('#review').fill('This product review validates the review submission workflow.');
    await page.locator('#button-review').click();

    await expect(page.getByText('Thank you for your review.')).toBeVisible();
  });

  test('@products @negative product review requires an email address', async ({ page }) => {
    const productsPage = await openProductsPage(page);
    await productsPage.openFirstProductDetails();

    await page.locator('#name').fill('Missing Email Reviewer');
    await page.locator('#review').fill('Email should be required before review submission.');
    await page.locator('#button-review').click();

    await expectHtml5ValidationMessage(page.locator('#email'), /fill out this field|required/i);
  });

  test('@products @negative product review requires a valid email address', async ({ page }) => {
    const productsPage = await openProductsPage(page);
    await productsPage.openFirstProductDetails();

    await page.locator('#name').fill('Invalid Email Reviewer');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#review').fill('Email format should be validated before review submission.');
    await page.locator('#button-review').click();

    await expectHtml5ValidationMessage(page.locator('#email'), /include an '@'|valid email/i);
  });

  test('@products @session products page survives page refresh', async ({ page }) => {
    const productsPage = await openProductsPage(page);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await productsPage.expectAllProductsLoaded();
  });

  test('@products @session products page survives browser back navigation from details', async ({ page }) => {
    const productsPage = await openProductsPage(page);
    await productsPage.openFirstProductDetails();
    await productsPage.expectProductDetails();

    await page.goBack();

    await productsPage.expectAllProductsLoaded();
  });

});
