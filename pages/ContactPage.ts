import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ContactPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async submitMessage(options: { name: string; email: string; subject: string; message: string; filePath?: string }): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
    await this.page.locator('[data-qa="name"]').fill(options.name);
    await this.page.locator('[data-qa="email"]').fill(options.email);
    await this.page.locator('[data-qa="subject"]').fill(options.subject);
    await this.page.locator('[data-qa="message"]').fill(options.message);
    if (options.filePath) {
      await this.page.locator('input[name="upload_file"]').setInputFiles(options.filePath);
    }
    const dialogPromise = this.page
      .waitForEvent('dialog', { timeout: 3_000 })
      .then(async (dialog) => {
        await dialog.accept();
      })
      .catch(() => undefined);

    await this.page.locator('[data-qa="submit-button"]').click();
    await dialogPromise;
  }

  async attachFile(filePath: string): Promise<void> {
    await this.page.locator('input[name="upload_file"]').setInputFiles(filePath);
  }

  async expectAttachedFile(fileName: string): Promise<void> {
    await expect(this.page.locator('input[name="upload_file"]')).toHaveValue(new RegExp(`${fileName}$`));
  }

  async expectSuccess(): Promise<void> {
    const status = this.page.locator('#contact-page .status');
    await expect(status).toHaveClass(/alert-success/);
    await expect(status).toContainText('Success! Your details have been submitted successfully.');
  }
}
