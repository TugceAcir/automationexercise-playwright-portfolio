import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';

async function openProductsWithCategories(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /All Products/i })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

async function openCategoryGroup(page: Page, groupName: string): Promise<void> {
  const group = page.locator(`a[href="#${groupName}"]`);
  await group.click();
}

test.describe('Category navigation', () => {
  test('@CAT001 @category @smoke visitor can browse women dress products', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Women');
    await page.locator('#Women').getByRole('link', { name: /Dress/i }).click();

    await expect(page.getByRole('heading', { name: /Women - Dress Products/i })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@CAT002 @category @regression visitor can switch from women to men categories', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Women');
    await expect(page.locator('#Women').getByRole('link', { name: /Tops/i })).toBeVisible();

    await openCategoryGroup(page, 'Men');
    await page.locator('#Men').getByRole('link', { name: /Jeans/i }).click();

    await expect(page.getByRole('heading', { name: /Men - Jeans Products/i })).toBeVisible();
  });

  test('@CAT003 @category @edge visitor can browse kids tops and shirts products', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Kids');
    await page.locator('#Kids').getByRole('link', { name: /Tops & Shirts/i }).click();

    await expect(page.getByRole('heading', { name: /Kids - Tops & Shirts Products/i })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@CAT004 @category @negative invalid category route does not show a valid category identity', async ({ page }) => {
    await page.goto('/category_products/999999', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '- Products' })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper:visible')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
  });
});
