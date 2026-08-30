import { expect, type Locator, type Page } from '@playwright/test';
import { actAndExpectHealthyNavigation, expectHealthyDemoPage, gotoDemoPage } from './app-navigation';
import { expectHtml5ValidationMessage } from './html5-validation';

const SUBSCRIBE_CONFIRM_TIMEOUT = 5_000;
const SUBSCRIBE_RETRY_TIMEOUT = 30_000;

export abstract class BasePage {
  protected readonly page: Page;

  protected constructor(page: Page) {
    this.page = page;
  }

  // The subscription form is in the site-wide footer, so it lives here rather than on one
  // page object: @HOME002 subscribes from the home page and @CART007 from the cart page,
  // against the same markup and the same handler.
  //
  // What the demo site actually does (static/js/subscription.js, verified 2026-08-10):
  // the handler is bound to the form's submit event and ends in `return false`, so a
  // subscription emits NO application request - actAndConfirmDemoRequest() would have
  // nothing to confirm. It reveals #success-subscribe, then a 1500 ms timer hides the
  // alert again and clears the email field. The alert is therefore short-lived, and it
  // starts hidden by Bootstrap's `.hide` CSS rather than by any script.
  //
  // Why the retry: @HOME002 has been observed failing with the click executed, a valid
  // address in the field and no alert - the submit handler simply did not run. The reason
  // is NOT yet established. An earlier explanation, that the click lands before the
  // handler binds, is disproven: jquery.js and subscription.js are parser-blocking
  // scripts, so `domcontentloaded` cannot fire until both have executed, and the handler
  // measured as bound in all three browsers at the instant gotoDemoPage() returns.
  // Re-issuing the click until the alert confirms the handler ran repairs the failure
  // without depending on which mechanism causes it.
  async subscribe(email: string): Promise<void> {
    await this.scrollToSubscriptionForm();

    await expect(async () => {
      // Only the alert can prove success here. A cleared field cannot: the field is also
      // empty before the flow ever fills it, so treating "empty" as confirmation would
      // report success on a page where nothing was submitted.
      if (await this.hasSubscriptionSuccess()) {
        return;
      }

      await this.fillSubscriptionEmail(email);
      await this.submitSubscription();
      await expect(this.subscriptionSuccessAlert()).toBeVisible({ timeout: SUBSCRIBE_CONFIRM_TIMEOUT });
    }).toPass({ timeout: SUBSCRIBE_RETRY_TIMEOUT });
  }

  // The negative subscription cases drive the footer form one step at a time, so they need
  // these separately from subscribe(). They stay here, beside the selectors subscribe()
  // already owns, so the form's markup is described in exactly one place.
  async scrollToSubscriptionForm(): Promise<void> {
    await this.subscriptionEmailField().scrollIntoViewIfNeeded();
  }

  async fillSubscriptionEmail(email: string): Promise<void> {
    const emailField = this.subscriptionEmailField();

    await emailField.scrollIntoViewIfNeeded();
    await emailField.fill(email);
  }

  async submitSubscription(): Promise<void> {
    await this.page.locator('#subscribe').click();
  }

  // Wraps the assertion rather than exposing the field, so the element never reaches a
  // spec: a method that returns a Locator would only move the selector, leaving the spec
  // performing UI mechanics.
  async expectSubscriptionValidationMessage(pattern: RegExp): Promise<void> {
    await expectHtml5ValidationMessage(this.subscriptionEmailField(), pattern);
  }

  async scrollToFooter(): Promise<void> {
    await this.page.locator('#footer').scrollIntoViewIfNeeded();
  }

  async useScrollUpControl(): Promise<void> {
    await this.page.locator('#scrollUp').click();
  }

  protected subscriptionEmailField(): Locator {
    return this.page.locator('#susbscribe_email');
  }

  async expectSubscriptionSuccess(): Promise<void> {
    await expect(this.subscriptionSuccessAlert()).toBeVisible();
  }

  protected subscriptionSuccessAlert(): Locator {
    return this.page.getByText('You have been successfully subscribed!');
  }

  // Must return a boolean rather than assert, so an unconfirmed subscription always
  // reaches the retry above instead of failing the run from inside the check.
  protected async hasSubscriptionSuccess(): Promise<boolean> {
    return this.subscriptionSuccessAlert()
      .isVisible()
      .catch(() => false);
  }

  async goto(path = '/'): Promise<void> {
    await gotoDemoPage(this.page, path);
    await this.dismissConsentIfPresent();
  }

  async expectPageTitle(): Promise<void> {
    await expectHealthyDemoPage(this.page);
    await expect(this.page).toHaveTitle(/Automation Exercise/);
  }

  async navigateToProducts(): Promise<void> {
    await this.navigateByHeaderLink('/products', this.page.getByRole('heading', { name: /All Products/i }));
  }

  async navigateToCart(): Promise<void> {
    await this.navigateByHeaderLink('/view_cart', this.page.locator('#cart_info'));
  }

  async navigateToSignupLogin(): Promise<void> {
    await this.navigateByHeaderLink('/login', this.page.getByRole('heading', { name: 'New User Signup!' }));
  }

  async navigateToContactUs(): Promise<void> {
    await this.navigateByHeaderLink('/contact_us', this.page.getByRole('heading', { name: 'Get In Touch' }));
  }

  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async continueShopping(): Promise<void> {
    const cartModal = this.page.locator('#cartModal');
    const continueButton = cartModal.getByRole('button', { name: 'Continue Shopping' });

    await expect(cartModal).toBeVisible();
    await continueButton.click();
    if (await cartModal.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape');
    }
    await expect(cartModal).toBeHidden();
    await expect(this.page.locator('.modal-backdrop')).toHaveCount(0);
  }

  async viewCartFromModal(): Promise<void> {
    const viewCartLink = this.page.locator('#cartModal').getByRole('link', { name: 'View Cart' });

    await actAndExpectHealthyNavigation(this.page, {
      acceptAlreadyReady: true,
      act: async () => {
        await this.expectCartModalVisible();
        await viewCartLink.click();
      },
      expectReady: async () => {
        await expect(this.page.locator('#cart_info')).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/view_cart');
      }
    });
  }

  protected async expectCartModalVisible(): Promise<void> {
    const cartModal = this.page.locator('#cartModal');

    await expect(cartModal).toBeVisible();
    await expect(cartModal.getByRole('heading', { name: 'Added!' })).toBeVisible();
    await expect(cartModal).toContainText('Your product has been added to cart.');
  }

  protected async expectCartModalScriptReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const maybeWindow = window as typeof window & {
        jQuery?: { fn?: { modal?: unknown } };
      };

      return typeof maybeWindow.jQuery?.fn?.modal === 'function';
    });
  }

  private async navigateByHeaderLink(path: string, destinationReady: Locator): Promise<void> {
    const headerLink = this.page.locator(`a[href="${path}"]`);

    await actAndExpectHealthyNavigation(this.page, {
      act: async () => {
        await expect(headerLink).toBeVisible();
        await headerLink.click();
      },
      expectReady: async () => {
        await expect(destinationReady).toBeVisible();
      },
      recover: async () => {
        await gotoDemoPage(this.page, '/');
      },
      retryOnNavigationTimeout: true
    });

    await this.dismissConsentIfPresent();
  }

  protected async dismissConsentIfPresent(): Promise<void> {
    const consentButton = this.page
      .getByRole('button', { name: /consent|agree|accept|ok/i })
      .or(this.page.locator('.fc-cta-consent'))
      .or(this.page.locator('#dismiss-button'))
      .first();

    await consentButton.click({ timeout: 500 }).catch(() => undefined);
  }
}
