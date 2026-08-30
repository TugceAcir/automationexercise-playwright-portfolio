import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { expectHealthyDemoPage } from './app-navigation';
import { expectHtml5ValidationMessage } from './html5-validation';

type ContactFormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export class ContactPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectFormReady(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
    await expect(this.field('name')).toBeVisible();
    await expect(this.field('email')).toBeVisible();
    await expect(this.field('subject')).toBeVisible();
    await expect(this.field('message')).toBeVisible();
  }

  async fillForm(values: ContactFormValues): Promise<void> {
    await this.field('name').fill(values.name);
    await this.field('email').fill(values.email);
    await this.field('subject').fill(values.subject);
    await this.field('message').fill(values.message);
  }

  async expectFormValues(values: ContactFormValues): Promise<void> {
    await expect(this.field('name')).toHaveValue(values.name);
    await expect(this.field('email')).toHaveValue(values.email);
    await expect(this.field('subject')).toHaveValue(values.subject);
    await expect(this.field('message')).toHaveValue(values.message);
  }

  async submitForm(): Promise<void> {
    await this.field('submit-button').click();
  }

  // Wrapped rather than exposed for the same reason as the subscription form: returning
  // the Locator would leave the spec doing UI mechanics.
  async expectEmailValidationMessage(pattern: RegExp): Promise<void> {
    await expectHtml5ValidationMessage(this.field('email'), pattern);
  }

  private field(name: string): Locator {
    return this.page.locator(`[data-qa="${name}"]`);
  }

  async submitMessage(options: { name: string; email: string; subject: string; message: string; filePath?: string }): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
    await this.fillForm(options);
    if (options.filePath) {
      await this.page.locator('input[name="upload_file"]').setInputFiles(options.filePath);
    }
    const dialogPromise = this.page
      .waitForEvent('dialog', { timeout: 15_000 })
      .then(async (dialog) => {
        await dialog.accept();
      })
      .catch(() => undefined);

    await this.submitForm();
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
    await expectHealthyDemoPage(this.page);
    await expect(status).toHaveClass(/alert-success/);
    await expect(status).toContainText('Success! Your details have been submitted successfully.');
  }
}
