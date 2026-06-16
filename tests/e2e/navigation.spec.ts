import { test, expect } from '../../fixtures/pages.fixture';

test.describe('Static navigation', () => {
  test('@NAV001 @navigation @smoke visitor can open the test cases page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('header').getByRole('link', { name: /Test Cases/i }).click();

    await expect(page).toHaveURL(/\/test_cases/);
    await expect(page.getByRole('heading', { name: 'Test Cases', exact: true })).toBeVisible();
    await expect(page.getByText('Below is the list of test Cases')).toBeVisible();
  });

  test('@NAV002 @navigation @smoke visitor can open the API testing page as static UI', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: /API Testing/i }).click();

    await expect(page).toHaveURL(/\/api_list/);
    await expect(page.getByRole('heading', { name: /APIs List for practice/i })).toBeVisible();
  });

  test('@NAV003 @navigation @edge video tutorials link points to the external YouTube channel', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const videoLink = page.getByRole('link', { name: /Video Tutorials/i });

    await expect(videoLink).toHaveAttribute('href', /youtube\.com\/c\/AutomationExercise/);
  });
});
