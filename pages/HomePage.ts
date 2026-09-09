import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndConfirmDemoRequest } from './app-navigation';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.goto('/');
  }

  async expectLoaded(): Promise<void> {
    await this.expectPageTitle();
    await expect(this.page.getByRole('heading', { name: 'AutomationExercise' }).first()).toBeVisible();
    await expect(this.page.getByText('Full-Fledged practice website for Automation Engineers').first()).toBeVisible();
  }

  private recommendedItemsHeading(): Locator {
    return this.page.getByRole('heading', { name: /recommended items/i });
  }

  async expectRecommendedItems(): Promise<void> {
    await this.recommendedItemsHeading().scrollIntoViewIfNeeded();
    await expect(this.recommendedItemsHeading()).toBeVisible();
  }

  // Adding from the recommended items is an ordinary add_to_cart XHR, and the cart modal
  // only renders once it comes back. The spec used to click this bare — the one add in the
  // suite that did — so on a slow response the next step asserted against a cart the site
  // had not written yet, and the scenario failed and then passed on retry.
  //
  // The items sit in a carousel that auto-advances every 5s, so ".item.active" is whichever
  // slide is on screen when the click resolves. That costs time when a click lands mid
  // transition, but it is not a correctness problem: Playwright re-resolves and the add
  // still lands exactly once. The confirmation below is what makes the step reliable.
  async addFirstRecommendedItemToCart(): Promise<void> {
    await this.expectRecommendedItems();
    await this.expectCartModalScriptReady();

    const addToCart = this.page.locator('.recommended_items .item.active a[data-product-id]').first();
    await expect(addToCart).toBeVisible();

    await actAndConfirmDemoRequest(this.page, {
      act: async () => addToCart.click(),
      requestMatches: (request) => /\/add_to_cart\/\d+/.test(new URL(request.url()).pathname),
      operationName: 'Adding a recommended item to the cart',
      retryServerError: true,
      isCommitted: async () => this.hasCartModalOpened()
    });

    await this.expectCartModalVisible();
  }
}
