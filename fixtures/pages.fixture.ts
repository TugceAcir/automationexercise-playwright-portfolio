import { test as base } from '@playwright/test';
import { AccountPage } from '../pages/AccountPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ContactPage } from '../pages/ContactPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { ProductsPage } from '../pages/ProductsPage';
import { blockThirdPartyNoise } from './network';

type Pages = {
  accountPage: AccountPage;
  blockThirdPartyNoise: void;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  contactPage: ContactPage;
  homePage: HomePage;
  loginPage: LoginPage;
  productDetailPage: ProductDetailPage;
  productsPage: ProductsPage;
};

export const test = base.extend<Pages>({
  blockThirdPartyNoise: [
    async ({ page }, use) => {
      await blockThirdPartyNoise(page);
      await use();
    },
    { auto: true }
  ],
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  contactPage: async ({ page }, use) => {
    await use(new ContactPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  productDetailPage: async ({ page }, use) => {
    await use(new ProductDetailPage(page));
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  }
});

export { expect } from '@playwright/test';
