import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';

async function openProductsWithCategories(page: Page): Promise<void> {
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /All Products/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
}

async function openCategoryGroup(page: Page, groupName: string): Promise<void> {
  const group = page.locator(`a[href="#${groupName}"]`);
  await group.click();
}

test.describe('Category navigation', () => {
  test('@category @smoke visitor can browse women dress products', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Women');
    await page.locator('#Women').getByRole('link', { name: /Dress/i }).click();

    await expect(page).toHaveURL(/category_products\/1/);
    await expect(page.getByRole('heading', { name: /Women - Dress Products/i })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@category @regression visitor can switch from women to men categories', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Women');
    await page.locator('#Women').getByRole('link', { name: /Tops/i }).click();
    await expect(page.getByRole('heading', { name: /Women - Tops Products/i })).toBeVisible();

    await page.locator('a[href="#Men"]').click();
    await page.locator('a[href="/category_products/6"]').evaluate((element) => {
      (element as HTMLElement).click();
    });

    await expect(page).toHaveURL(/category_products\/6/);
    await expect(page.getByRole('heading', { name: /Men - Jeans Products/i })).toBeVisible();
  });

  test('@category @edge visitor can browse kids tops and shirts products', async ({ page }) => {
    await openProductsWithCategories(page);

    await openCategoryGroup(page, 'Kids');
    await page.locator('#Kids').getByRole('link', { name: /Tops & Shirts/i }).click();

    await expect(page).toHaveURL(/category_products\/5/);
    await expect(page.getByRole('heading', { name: /Kids - Tops & Shirts Products/i })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@category @negative invalid category route does not show a valid category identity', async ({ page }) => {
    await page.goto('/category_products/999999', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: '- Products' })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper:visible')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
  });
});
