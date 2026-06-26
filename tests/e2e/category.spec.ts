import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { actAndExpectHealthyNavigation, gotoDemoPage } from '../../pages/app-navigation';

async function openProductsWithCategories(page: Page): Promise<void> {
  await gotoDemoPage(page, '/products');
  await expect(page.getByRole('heading', { name: /All Products/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
}

async function openCategoryGroup(page: Page, groupName: string): Promise<void> {
  const group = page.locator(`a[href="#${groupName}"]`);
  await group.click();
}

async function browseCategory(page: Page, groupName: string, linkName: RegExp, headingName: RegExp): Promise<void> {
  await openProductsWithCategories(page);
  await openCategoryGroup(page, groupName);
  await chooseCategory(page, groupName, linkName, headingName);
}

async function chooseCategory(page: Page, groupName: string, linkName: RegExp, headingName: RegExp): Promise<void> {
  const categoryLink = page.locator(`#${groupName}`).getByRole('link', { name: linkName });
  const categoryHeading = page.getByRole('heading', { name: headingName });

  await actAndExpectHealthyNavigation(page, {
    act: async () => {
      await expect(categoryLink).toBeVisible();
      await categoryLink.click();
    },
    expectReady: async () => {
      await expect(categoryHeading).toBeVisible();
    },
    recover: async () => {
      await openProductsWithCategories(page);
      await openCategoryGroup(page, groupName);
    }
  });
}

test.describe('Category navigation', () => {
  test('@CAT001 @category @smoke visitor can browse women dress products', async ({ page }) => {
    await browseCategory(page, 'Women', /Dress/i, /Women - Dress Products/i);

    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@CAT002 @category @regression visitor can switch from women to men categories', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Women');
    await expect(page.locator('#Women').getByRole('link', { name: /Tops/i })).toBeVisible();

    await openCategoryGroup(page, 'Men');
    await chooseCategory(page, 'Men', /Jeans/i, /Men - Jeans Products/i);
  });

  test('@CAT003 @category @edge visitor can browse kids tops and shirts products', async ({ page }) => {
    await browseCategory(page, 'Kids', /Tops & Shirts/i, /Kids - Tops & Shirts Products/i);

    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@CAT004 @category @negative invalid category route does not show a valid category identity', async ({ page }) => {
    await gotoDemoPage(page, '/category_products/999999');

    await expect(page.getByRole('heading', { name: '- Products' })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper:visible')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
  });
});
