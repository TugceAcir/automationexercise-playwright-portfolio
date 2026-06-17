import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { ContactPage } from '../../pages/ContactPage';
import { createTestUser } from '../../test-data/user.factory';
import { expectHtml5ValidationMessage } from '../support/test-actions';

type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

function createContactMessage(label: string): ContactMessage {
  const user = createTestUser(label);

  return {
    name: user.name,
    email: user.email,
    subject: `Portfolio automation contact test ${label}`,
    message: `This message validates the contact form workflow for ${label}.`
  };
}

async function openContactPage(page: Page): Promise<void> {
  await page.goto('/contact_us', { waitUntil: 'domcontentloaded' });
  await expectContactForm(page);
}

async function expectContactForm(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Get In Touch' })).toBeVisible();
  await expect(page.locator('[data-qa="name"]')).toBeVisible();
  await expect(page.locator('[data-qa="email"]')).toBeVisible();
  await expect(page.locator('[data-qa="subject"]')).toBeVisible();
  await expect(page.locator('[data-qa="message"]')).toBeVisible();
}

async function fillContactForm(page: Page, message: ContactMessage): Promise<void> {
  await page.locator('[data-qa="name"]').fill(message.name);
  await page.locator('[data-qa="email"]').fill(message.email);
  await page.locator('[data-qa="subject"]').fill(message.subject);
  await page.locator('[data-qa="message"]').fill(message.message);
}

async function expectContactFormValues(page: Page, message: ContactMessage): Promise<void> {
  await expect(page.locator('[data-qa="name"]')).toHaveValue(message.name);
  await expect(page.locator('[data-qa="email"]')).toHaveValue(message.email);
  await expect(page.locator('[data-qa="subject"]')).toHaveValue(message.subject);
  await expect(page.locator('[data-qa="message"]')).toHaveValue(message.message);
}

test.describe('Customer support', () => {
  test('@CONTACT001 @contact @regression visitor can select an attachment for the contact form', async ({ homePage, contactPage }) => {
    const filePath = path.resolve('test-data/upload-sample.txt');

    await homePage.open();
    await homePage.navigateToContactUs();

    await contactPage.attachFile(filePath);
    await contactPage.expectAttachedFile('upload-sample.txt');
  });

  test('@CONTACT002 @contact @smoke visitor can submit the contact form without an attachment', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const message = createContactMessage('contact-no-file');

    await openContactPage(page);

    await contactPage.submitMessage(message);

    await contactPage.expectSuccess();
  });

  test('@CONTACT003 @contact @negative contact form requires an email before submit', async ({ page }) => {
    await openContactPage(page);

    await page.locator('[data-qa="name"]').fill('Missing Email Visitor');
    await page.locator('[data-qa="subject"]').fill('Missing name validation');
    await page.locator('[data-qa="message"]').fill('The form should request an email.');
    await page.locator('[data-qa="submit-button"]').click();

    await expectHtml5ValidationMessage(page.locator('[data-qa="email"]'), /fill out this field|required/i);
  });

  test('@CONTACT004 @contact @negative contact form requires a valid email address', async ({ page }) => {
    await openContactPage(page);

    await page.locator('[data-qa="name"]').fill('Invalid Email Visitor');
    await page.locator('[data-qa="email"]').fill('not-an-email');
    await page.locator('[data-qa="subject"]').fill('Invalid email validation');
    await page.locator('[data-qa="message"]').fill('The form should request a valid email.');
    await page.locator('[data-qa="submit-button"]').click();

    await expectHtml5ValidationMessage(page.locator('[data-qa="email"]'), /include an '@'|valid email|email address/i);
  });

  test('@CONTACT005 @contact @edge visitor can submit a long message with punctuation', async ({ page }) => {
    const contactPage = new ContactPage(page);
    const message = {
      ...createContactMessage('contact-edge'),
      subject: "Question about checkout, cart, and login - O'Connor QA",
      message: `Edge contact note: ${'Symbols !? % # and long text should remain submit-ready. '.repeat(20)}`
    };

    await openContactPage(page);

    await contactPage.submitMessage(message);

    await contactPage.expectSuccess();
  });

  test('@CONTACT006 @contact @session contact form returns to a clean state after page refresh', async ({ page }) => {
    const message = createContactMessage('contact-refresh');

    await openContactPage(page);
    await fillContactForm(page, message);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectContactForm(page);
    await expect(page.locator('[data-qa="name"]')).toHaveValue('');
    await expect(page.locator('[data-qa="email"]')).toHaveValue('');
    await expect(page.locator('[data-qa="subject"]')).toHaveValue('');
    await expect(page.locator('[data-qa="message"]')).toHaveValue('');
  });

  test('@CONTACT007 @contact @session contact form draft survives browser back navigation', async ({ page }) => {
    const message = createContactMessage('contact-back');

    await openContactPage(page);
    await fillContactForm(page, message);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.goBack();

    await expectContactForm(page);
    await expectContactFormValues(page, message);
  });

});
