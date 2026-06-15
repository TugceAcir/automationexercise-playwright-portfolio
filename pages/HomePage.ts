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

  async subscribe(email: string): Promise<void> {
    await this.page.locator('#susbscribe_email').scrollIntoViewIfNeeded();
    await this.page.locator('#susbscribe_email').fill(email);
    await this.page.locator('#subscribe').click();
  }

  async expectSubscriptionSuccess(): Promise<void> {
    await expect(this.page.getByText('You have been successfully subscribed!')).toBeVisible();
  }
}
