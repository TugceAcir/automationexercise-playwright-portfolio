import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectHealthyDemoPage } from './app-navigation';
import type { PaymentDetails } from '../test-data/payment.factory';

export class CheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectAddressAndOrderReview(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Address Details' })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Review Your Order' })).toBeVisible();
  }

  async placeOrder(comment: string): Promise<void> {
    await this.page.locator('textarea[name="message"]').fill(comment);
    await this.page.getByRole('link', { name: 'Place Order' }).click();
  }

  async pay(details: PaymentDetails): Promise<void> {
    await this.page.locator('[data-qa="name-on-card"]').fill(details.nameOnCard);
    await this.page.locator('[data-qa="card-number"]').fill(details.cardNumber);
    await this.page.locator('[data-qa="cvc"]').fill(details.cvc);
    await this.page.locator('[data-qa="expiry-month"]').fill(details.expirationMonth);
    await this.page.locator('[data-qa="expiry-year"]').fill(details.expirationYear);
    await this.page.locator('[data-qa="pay-button"]').click();
  }

  async expectOrderPlaced(): Promise<void> {
    const orderPlaced = this.page.locator('[data-qa="order-placed"]');

    await expect(async () => {
      await expectHealthyDemoPage(this.page);

      if (!(await orderPlaced.isVisible().catch(() => false)) && /\/payment_done/.test(this.page.url())) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await expectHealthyDemoPage(this.page);
      }

      await expect(orderPlaced).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
  }
}
