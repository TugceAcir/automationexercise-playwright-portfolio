import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { actAndConfirmDemoRequest } from './app-navigation';
import { expectHtml5ValidationMessage } from './html5-validation';

type ReviewValues = {
  name: string;
  // Optional so @PROD009 can submit without one and assert the browser blocks it.
  email?: string;
  review: string;
};

export class ProductDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(productId: number): Promise<void> {
    await this.goto(`/product_details/${productId}`);
    await this.expectProductInformation();
  }

  async expectProductInformation(): Promise<void> {
    const productInformation = this.page.locator('.product-information');

    await expect(productInformation).toBeVisible();
    await expect(productInformation).toContainText('Category:');
    await expect(productInformation).toContainText('Availability:');
    await expect(productInformation).toContainText('Condition:');
    await expect(productInformation).toContainText('Brand:');
  }

  async addCurrentProductToCart(quantity = '1'): Promise<void> {
    await this.expectProductInformation();
    await this.page.locator('#quantity').fill(quantity);
    await this.expectCartModalScriptReady();
    await actAndConfirmDemoRequest(this.page, {
      act: async () => this.page.getByRole('button', { name: 'Add to cart' }).click(),
      requestMatches: (request) => {
        const url = new URL(request.url());
        return /\/add_to_cart\/\d+/.test(url.pathname) && url.searchParams.get('quantity') === quantity;
      },
      operationName: 'Adding the current product to the cart',
      retryServerError: true,
      // Without this, a request that was merely missed inside the wait window replays the
      // click and adds the product twice — which the exact-quantity assertions in @CART001,
      // @CART003, @CART006 and @CART008 are the tripwire for.
      isCommitted: async () => this.hasCartModalOpened()
    });
    await this.expectCartModalVisible();
  }

  async expectReviewFormReady(): Promise<void> {
    await expect(this.page.getByRole('link', { name: /Write Your Review/i })).toBeVisible();
  }

  async fillReview(values: ReviewValues): Promise<void> {
    await this.reviewField('name').fill(values.name);
    if (values.email !== undefined) {
      await this.reviewField('email').fill(values.email);
    }
    await this.reviewField('review').fill(values.review);
  }

  async submitReview(): Promise<void> {
    await this.reviewField('button-review').click();
  }

  async expectReviewSubmitted(): Promise<void> {
    await expect(this.page.getByText('Thank you for your review.')).toBeVisible();
  }

  // Wrapped rather than exposed, for the same reason as ContactPage.expectEmailValidationMessage:
  // returning the Locator would leave the spec doing UI mechanics.
  async expectReviewEmailValidationMessage(pattern: RegExp): Promise<void> {
    await expectHtml5ValidationMessage(this.reviewField('email'), pattern);
  }

  private reviewField(id: string): Locator {
    return this.page.locator(`#${id}`);
  }
}
