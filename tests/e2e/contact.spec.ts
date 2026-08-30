import path from 'node:path';
import type { Page } from '@playwright/test';
import { test } from '../../fixtures/pages.fixture';
import { expectHealthyDemoPage, gotoDemoPage, reloadDemoPage } from '../../pages/app-navigation';
import { ContactPage } from '../../pages/ContactPage';
import { createTestUser } from '../../test-data/user.factory';

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

async function openContactPage(page: Page): Promise<ContactPage> {
  const contactPage = new ContactPage(page);

  await gotoDemoPage(page, '/contact_us');
  await contactPage.expectFormReady();

  return contactPage;
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
    const message = createContactMessage('contact-no-file');

    const contactPage = await openContactPage(page);

    await contactPage.submitMessage(message);

    await contactPage.expectSuccess();
  });

  test('@CONTACT003 @contact @negative contact form requires an email before submit', async ({ page }) => {
    const contactPage = await openContactPage(page);

    await contactPage.fillForm({
      name: 'Missing Email Visitor',
      email: '',
      subject: 'Missing name validation',
      message: 'The form should request an email.'
    });
    await contactPage.submitForm();

    await contactPage.expectEmailValidationMessage(/fill out this field|required/i);
  });

  test('@CONTACT004 @contact @negative contact form requires a valid email address', async ({ page }) => {
    const contactPage = await openContactPage(page);

    await contactPage.fillForm({
      name: 'Invalid Email Visitor',
      email: 'not-an-email',
      subject: 'Invalid email validation',
      message: 'The form should request a valid email.'
    });
    await contactPage.submitForm();

    await contactPage.expectEmailValidationMessage(/include an '@'|valid email|email address/i);
  });

  test('@CONTACT005 @contact @edge visitor can submit a long message with punctuation', async ({ page }) => {
    const message = {
      ...createContactMessage('contact-edge'),
      subject: "Question about checkout, cart, and login - O'Connor QA",
      message: `Edge contact note: ${'Symbols !? % # and long text should remain submit-ready. '.repeat(20)}`
    };

    const contactPage = await openContactPage(page);

    await contactPage.submitMessage(message);

    await contactPage.expectSuccess();
  });

  test('@CONTACT006 @contact @session contact form returns to a clean state after page refresh', async ({ page }) => {
    const message = createContactMessage('contact-refresh');

    const contactPage = await openContactPage(page);
    await contactPage.fillForm(message);

    await reloadDemoPage(page);

    await contactPage.expectFormReady();
    await contactPage.expectFormValues({ name: '', email: '', subject: '', message: '' });
  });

  test('@CONTACT007 @contact @session contact form remains usable after browser back navigation', async ({ page }) => {
    const originalDraft = createContactMessage('contact-back-original');
    const replacementDraft = createContactMessage('contact-back-replacement');

    const contactPage = await openContactPage(page);
    await contactPage.fillForm(originalDraft);
    await gotoDemoPage(page, '/');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expectHealthyDemoPage(page);
    await contactPage.expectFormReady();

    await contactPage.fillForm(replacementDraft);
    await contactPage.expectFormValues(replacementDraft);
  });

});
