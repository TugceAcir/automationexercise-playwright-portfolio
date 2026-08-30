import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { reloadDemoPage } from '../../pages/app-navigation';
import { gotoDemoPage } from '../../pages/app-navigation';
import { HomePage } from '../../pages/HomePage';
import { createTestUser } from '../../test-data/user.factory';

async function openHomePage(page: Page): Promise<HomePage> {
  const homePage = new HomePage(page);
  await gotoDemoPage(page, '/');
  await homePage.expectLoaded();
  return homePage;
}

test.describe('Home experience', () => {
  test('@HOME001 @home @smoke home page loads with core navigation', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Signup / Login' })).toBeVisible();
  });

  test('@HOME002 @home @regression visitor can subscribe from the home page', async ({ homePage }) => {
    const user = createTestUser('subscription');

    await homePage.open();
    await homePage.subscribe(user.email);

    await homePage.expectSubscriptionSuccess();
  });

  test('@HOME003 @home @smoke home page shows product discovery sections', async ({ page }) => {
    await openHomePage(page);

    await expect(page.getByRole('heading', { name: 'Category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Brands' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Features Items' })).toBeVisible();
    await expect(page.locator('.features_items .product-image-wrapper').first()).toBeVisible();
  });

  test('@HOME004 @home @negative subscription requires an email address', async ({ page }) => {
    const homePage = await openHomePage(page);
    await homePage.scrollToSubscriptionForm();

    await homePage.submitSubscription();

    await homePage.expectSubscriptionValidationMessage(/fill out this field|required/i);
  });

  test('@HOME005 @home @negative subscription requires a valid email address', async ({ page }) => {
    const homePage = await openHomePage(page);
    await homePage.fillSubscriptionEmail('not-an-email');

    await homePage.submitSubscription();

    await homePage.expectSubscriptionValidationMessage(/include an '@'|valid email|email address/i);
  });

  test('@HOME006 @home @edge visitor can subscribe with a plus-address email', async ({ homePage }) => {
    const user = createTestUser('subscription-edge');
    const plusAddress = user.email.replace('@', '+home.edge@');

    await homePage.open();
    await homePage.subscribe(plusAddress);

    await homePage.expectSubscriptionSuccess();
  });

  test('@HOME007 @home @edge visitor can use the scroll-up control after reaching the footer', async ({ page }) => {
    const homePage = await openHomePage(page);
    await homePage.scrollToFooter();
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();

    await homePage.useScrollUpControl();

    await expect(page.getByRole('heading', { name: 'AutomationExercise' }).first()).toBeVisible();
  });

  test('@HOME008 @home @edge visitor can scroll back to the top without using the arrow control', async ({ page }) => {
    const homePage = await openHomePage(page);
    await homePage.scrollToFooter();
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page.getByText('Full-Fledged practice website for Automation Engineers').first()).toBeVisible();
  });

  test('@HOME009 @home @session home page survives page refresh', async ({ page }) => {
    const homePage = await openHomePage(page);

    await reloadDemoPage(page);

    await homePage.expectLoaded();
  });

  test('@HOME010 @home @session home page survives browser back navigation', async ({ page }) => {
    const homePage = await openHomePage(page);
    await gotoDemoPage(page, '/products');
    await expect(page).toHaveURL(/\/products/);

    await page.goBack({ waitUntil: 'domcontentloaded' });

    await homePage.expectLoaded();
  });

});
