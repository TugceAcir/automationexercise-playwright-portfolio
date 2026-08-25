import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

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
}
