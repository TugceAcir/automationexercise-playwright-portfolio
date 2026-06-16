import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { HomePage } from '../../pages/HomePage';
import { createTestUser } from '../../test-data/user.factory';
import { expectHtml5ValidationMessage } from '../support/test-actions';

async function openHomePage(page: Page): Promise<HomePage> {
  const homePage = new HomePage(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await homePage.expectLoaded();
  return homePage;
}

test.describe('Home experience', () => {
  test('@smoke home page loads with core navigation', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Signup / Login' })).toBeVisible();
  });

  test('@regression visitor can subscribe from the home page', async ({ homePage }) => {
    const user = createTestUser('subscription');

    await homePage.open();
    await homePage.subscribe(user.email);

    await homePage.expectSubscriptionSuccess();
  });

  test('@home @smoke home page shows product discovery sections', async ({ page }) => {
    await openHomePage(page);

    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Features Items' })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@home @negative subscription requires an email address', async ({ page }) => {
    await openHomePage(page);
    await page.locator('#susbscribe_email').scrollIntoViewIfNeeded();

    await page.locator('#subscribe').click();

    await expectHtml5ValidationMessage(page.locator('#susbscribe_email'), /fill out this field|required/i);
  });

  test('@home @negative subscription requires a valid email address', async ({ page }) => {
    await openHomePage(page);
    await page.locator('#susbscribe_email').scrollIntoViewIfNeeded();
    await page.locator('#susbscribe_email').fill('not-an-email');

    await page.locator('#subscribe').click();

    await expectHtml5ValidationMessage(page.locator('#susbscribe_email'), /include an '@'|valid email/i);
  });

  test('@home @edge visitor can subscribe with a plus-address email', async ({ homePage }) => {
    const user = createTestUser('subscription-edge');
    const plusAddress = user.email.replace('@', '+home.edge@');

    await homePage.open();
    await homePage.subscribe(plusAddress);

    await homePage.expectSubscriptionSuccess();
  });

  test('@home @edge visitor can use the scroll-up control after reaching the footer', async ({ page }) => {
    await openHomePage(page);
    await page.locator('#footer').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();

    await page.locator('#scrollUp').click();

    await expect(page.getByRole('heading', { name: 'AutomationExercise' }).first()).toBeVisible();
  });

  test('@home @edge visitor can scroll back to the top without using the arrow control', async ({ page }) => {
    await openHomePage(page);
    await page.locator('#footer').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page.getByText('Full-Fledged practice website for Automation Engineers').first()).toBeVisible();
  });

  test('@home @session home page survives page refresh', async ({ page }) => {
    const homePage = await openHomePage(page);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await homePage.expectLoaded();
  });

  test('@home @session home page survives browser back navigation', async ({ page }) => {
    const homePage = await openHomePage(page);
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/products/);

    await page.goBack();

    await homePage.expectLoaded();
  });

});
