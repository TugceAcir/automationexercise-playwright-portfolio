import { expect, type Download, type Page } from '@playwright/test';
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
    await expectHealthyDemoPage(this.page);
    await this.page.locator('textarea[name="message"]').fill(comment);
    await this.page.getByRole('link', { name: 'Place Order' }).click();
    await expectHealthyDemoPage(this.page);
    await expect(this.page).toHaveURL(/\/payment/);
  }

  async pay(details: PaymentDetails): Promise<void> {
    await this.page.locator('[data-qa="name-on-card"]').fill(details.nameOnCard);
    await this.page.locator('[data-qa="card-number"]').fill(details.cardNumber);
    await this.page.locator('[data-qa="cvc"]').fill(details.cvc);
    await this.page.locator('[data-qa="expiry-month"]').fill(details.expirationMonth);
    await this.page.locator('[data-qa="expiry-year"]').fill(details.expirationYear);
    await this.page.locator('[data-qa="pay-button"]').click({ noWaitAfter: true });
    await expect(this.page).toHaveURL(/\/payment_done\/\d+/);
  }

  async expectOrderPlaced(): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page.locator('[data-qa="order-placed"]')).toBeVisible();
  }

  async downloadInvoice(): Promise<Download> {
    const invoiceLink = this.page.getByRole('link', { name: /Download Invoice/i });

    await expectHealthyDemoPage(this.page);
    await expect(invoiceLink).toBeVisible();
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30_000 });
    await invoiceLink.click();
    return await downloadPromise;
  }
}
