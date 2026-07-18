import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DEMO_DOWNLOAD_TIMEOUT, DEMO_POST_SUBMIT_TIMEOUT, actAndConfirmDemoRequest, expectHealthyDemoPage } from './app-navigation';
import type { PaymentDetails } from '../test-data/payment.factory';

export type InvoiceDownloadEvidence = {
  suggestedFilename: string;
  sizeBytes: number;
};

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
    await actAndConfirmDemoRequest(this.page, {
      act: async () => this.page.getByRole('link', { name: 'Place Order' }).click(),
      requestMatches: (request) => new URL(request.url()).pathname === '/payment',
      operationName: 'Opening the payment page'
    });
    await expectHealthyDemoPage(this.page);
    await expect(this.page).toHaveURL(/\/payment/, { timeout: DEMO_POST_SUBMIT_TIMEOUT });
  }

  async pay(details: PaymentDetails): Promise<void> {
    const paymentForm = this.page.locator('#payment-form');
    const paymentFields = [
      { locator: this.page.locator('[data-qa="name-on-card"]'), value: details.nameOnCard },
      { locator: this.page.locator('[data-qa="card-number"]'), value: details.cardNumber },
      { locator: this.page.locator('[data-qa="cvc"]'), value: details.cvc },
      { locator: this.page.locator('[data-qa="expiry-month"]'), value: details.expirationMonth },
      { locator: this.page.locator('[data-qa="expiry-year"]'), value: details.expirationYear }
    ];

    for (const field of paymentFields) {
      await field.locator.fill(field.value);
      await expect(field.locator).toHaveValue(field.value);
    }

    expect(await paymentForm.evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true);
    await actAndConfirmDemoRequest(this.page, {
      act: async () => this.page.locator('[data-qa="pay-button"]').click(),
      requestMatches: (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/payment',
      operationName: 'Submitting payment'
    });
    await expectHealthyDemoPage(this.page);
    await expect(this.page).toHaveURL(/\/payment_done\/\d+/, { timeout: DEMO_POST_SUBMIT_TIMEOUT });
  }

  async expectOrderPlaced(): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page.locator('[data-qa="order-placed"]')).toBeVisible();
  }

  async downloadInvoice(): Promise<InvoiceDownloadEvidence> {
    const invoiceLink = this.page.getByRole('link', { name: /Download Invoice/i });

    await expectHealthyDemoPage(this.page);
    await expect(invoiceLink).toBeVisible();
    const href = await invoiceLink.getAttribute('href');

    if (!href) {
      throw new Error('The invoice download link did not include an href.');
    }

    const invoiceUrl = new URL(href, this.page.url()).toString();
    const response = await this.page.request.get(invoiceUrl, { timeout: DEMO_DOWNLOAD_TIMEOUT });
    const contentDisposition = response.headers()['content-disposition'] ?? '';
    const suggestedFilename = filenameFromContentDisposition(contentDisposition) ?? invoiceUrl;
    const body = await response.body();

    expect(response.status()).toBe(200);
    expect(`${contentDisposition} ${invoiceUrl}`).toMatch(/invoice/i);
    expect(body.length).toBeGreaterThan(0);

    return {
      suggestedFilename,
      sizeBytes: body.length
    };
  }
}

function filenameFromContentDisposition(contentDisposition: string): string | undefined {
  const filename = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition)?.[1];

  return filename ? decodeURIComponent(filename.trim()) : undefined;
}
