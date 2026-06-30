import { scenarioIdForScenario, type ScenarioResult } from './report-model';

// Scenario ID tags are the stable reporting contract, not the readable titles.
export function gherkinForScenario(scenario: ScenarioResult): string | undefined {
  const scenarioId = scenarioIdForScenario(scenario);
  if (!scenarioId) return undefined;

  const steps = gherkinTemplates[scenarioId];
  if (!steps) return undefined;

  const feature = scenario.feature;
  const scenarioName = scenario.title.split(' > ').at(-1) ?? scenario.title;
  const common = `Feature: ${feature}\n\nScenario: ${scenarioName}`;

  return `${common}\n${steps.map((step) => `  ${step}`).join('\n')}`;
}

export function missingGherkinForScenario(scenario: ScenarioResult, scenarioId?: string): string {
  const feature = scenario.feature;
  const scenarioName = scenario.title.split(' > ').at(-1) ?? scenario.title;
  const idText = scenarioId ?? 'missing scenario ID';

  return [
    `Feature: ${feature}`,
    '',
    `Scenario: ${scenarioName}`,
    `  Given the report cannot find a Gherkin template for ${idText}`,
    '  When the business report is generated',
    '  Then the missing template must be added before the report is considered complete'
  ].join('\n');
}

const gherkinTemplates: Record<string, string[]> = {
  AUTH001: [
    'Given a visitor opens the signup flow',
    'When the visitor registers with unique customer details',
    'Then the account is created and the customer is logged in',
    'And the account can be deleted as cleanup'
  ],
  AUTH002: [
    'Given a visitor opens the login form',
    'When invalid credentials are submitted',
    'Then a clear authentication error is shown'
  ],
  AUTH003: [
    'Given a registered customer is logged in',
    'When the customer logs out and logs in again',
    'Then the same customer session is restored'
  ],
  AUTH004: [
    'Given an email address already belongs to a customer',
    'When another signup is attempted with that email',
    'Then the application blocks the duplicate account'
  ],
  AUTH005: [
    'Given a visitor opens the login form',
    'When login is submitted without required credentials',
    'Then browser validation prevents submission'
  ],
  AUTH006: [
    'Given a visitor opens the signup form',
    'When required signup identity fields are missing or invalid',
    'Then browser validation explains the blocked signup'
  ],
  AUTH007: [
    'Given a visitor signs up with punctuation in the name',
    'When valid account details are submitted',
    'Then the account is created successfully'
  ],
  AUTH008: [
    'Given a customer is logged in',
    'When the account page is refreshed',
    'Then the logged-in identity remains visible'
  ],
  AUTH009: [
    'Given a customer is logged in and navigates away',
    'When the browser back button returns to the prior page',
    'Then the logged-in identity remains visible'
  ],
  CART001: [
    'Given a shopper opens the product catalogue',
    'When two different products are added to the cart',
    'Then both products appear with quantity one'
  ],
  CART002: [
    'Given a shopper has a product in the cart',
    'When the shopper removes that product',
    'Then the product row is no longer shown'
  ],
  CART003: [
    'Given a shopper opens a product details page',
    'When the shopper selects quantity four and adds the item',
    'Then the cart shows the selected quantity'
  ],
  CART004: [
    'Given a visitor opens an empty cart',
    'When no products are present',
    'Then checkout actions are not exposed'
  ],
  CART005: [
    'Given the cart contains one product',
    'When the shopper removes the only product',
    'Then the cart returns to the empty state'
  ],
  CART006: [
    'Given a shopper adds the same product twice',
    'When the cart is opened',
    'Then one cart line shows the combined quantity'
  ],
  CART007: [
    'Given a visitor opens the cart page',
    'When a valid email is submitted to the subscription form',
    'Then the visitor sees a subscription confirmation'
  ],
  CART008: [
    'Given a shopper adds a product with quantity four',
    'When the cart is opened',
    'Then price, quantity, and line total match the expected product data'
  ],
  CART009: [
    'Given a customer account exists',
    'When a searched product is added before login',
    'Then the cart still contains that product after login'
  ],
  CART010: [
    'Given a visitor views recommended items',
    'When one recommended item is added to the cart',
    'Then the cart contains the recommended product'
  ],
  CART011: [
    'Given a product is in the cart',
    'When the cart page is refreshed',
    'Then the product and quantity remain visible'
  ],
  CART012: [
    'Given a product is in the cart',
    'When the shopper navigates away and uses browser back',
    'Then the cart contents remain visible'
  ],
  CART013: [
    'Given a cart exists in browser storage',
    'When a new browser context is opened with that storage',
    'Then the cart contents can be restored'
  ],
  PROD001: [
    'Given a visitor opens product discovery',
    'When the visitor opens the first product details page',
    'Then catalogue and product detail information are visible'
  ],
  PROD002: [
    'Given a shopper opens the products catalogue',
    'When the shopper searches for a known product',
    'Then matching product results are displayed'
  ],
  PROD003: [
    'Given a shopper searches the product catalogue',
    'When the first result detail page is opened',
    'Then product identity and detail information are visible'
  ],
  PROD004: [
    'Given a shopper searches the product catalogue',
    'When no products match the search term',
    'Then no product cards are shown'
  ],
  PROD005: [
    'Given a visitor opens an invalid product details route',
    'When the page responds without a valid product',
    'Then no real product identity is shown'
  ],
  PROD006: [
    'Given a shopper opens product discovery',
    'When a partial product term is searched',
    'Then matching products are returned'
  ],
  PROD007: [
    'Given a visitor opens brand navigation',
    'When the visitor switches between two brand lists',
    'Then each selected brand list is shown'
  ],
  PROD008: [
    'Given a visitor opens a product details page',
    'When a valid product review is submitted',
    'Then the site confirms the review was received'
  ],
  PROD009: [
    'Given a visitor opens product review',
    'When review submission is attempted without an email',
    'Then browser validation blocks the submission'
  ],
  PROD010: [
    'Given a visitor opens product review',
    'When review submission uses an invalid email',
    'Then browser validation explains the invalid email'
  ],
  PROD011: [
    'Given a visitor opens the products page',
    'When the page is refreshed',
    'Then product discovery remains available'
  ],
  PROD012: [
    'Given a visitor opens a product detail from products',
    'When browser back returns to the catalogue',
    'Then the products page remains usable'
  ],
  CONTACT001: [
    'Given a visitor opens the contact form',
    'When a support attachment is selected',
    'Then the file input keeps the selected attachment'
  ],
  CONTACT002: [
    'Given a visitor opens the contact form',
    'When valid contact details are submitted without an attachment',
    'Then the site confirms the message was submitted successfully'
  ],
  CONTACT003: [
    'Given a visitor opens the contact form',
    'When the form is submitted without an email',
    'Then browser validation blocks the submission'
  ],
  CONTACT004: [
    'Given a visitor opens the contact form',
    'When the form is submitted with an invalid email',
    'Then browser validation explains the invalid email'
  ],
  CONTACT005: [
    'Given a visitor writes a long support message',
    'When the message includes punctuation and is submitted',
    'Then the site confirms the message was submitted successfully'
  ],
  CONTACT006: [
    'Given a visitor has typed into the contact form',
    'When the contact page is refreshed',
    'Then the form returns to a clean state'
  ],
  CONTACT007: [
    'Given a visitor has a contact form draft',
    'When the visitor navigates away and uses browser back',
    'Then the contact form remains healthy and accepts a new draft'
  ],
  CAT001: [
    'Given a visitor opens category navigation',
    'When Women Dress is selected',
    'Then women dress products are displayed'
  ],
  CAT002: [
    'Given a visitor opens category navigation',
    'When the visitor switches from Women to Men categories',
    'Then the selected men category products are displayed'
  ],
  CAT003: [
    'Given a visitor opens category navigation',
    'When Kids Tops and Shirts is selected',
    'Then kids tops and shirts products are displayed'
  ],
  CAT004: [
    'Given a visitor opens an invalid category route',
    'When the page does not resolve to a valid category',
    'Then no valid category product cards are shown'
  ],
  HOME001: [
    'Given a visitor opens the home page',
    'When the page loads',
    'Then core navigation is visible'
  ],
  HOME002: [
    'Given a visitor opens the home page',
    'When a valid email is submitted to the subscription form',
    'Then the visitor sees a subscription confirmation'
  ],
  HOME003: [
    'Given a visitor opens the home page',
    'When product discovery sections load',
    'Then category, brand, and featured items sections are visible'
  ],
  HOME004: [
    'Given a visitor opens the home subscription form',
    'When subscription is submitted without an email',
    'Then browser validation blocks the submission'
  ],
  HOME005: [
    'Given a visitor opens the home subscription form',
    'When subscription is submitted with an invalid email',
    'Then browser validation explains the invalid email'
  ],
  HOME006: [
    'Given a visitor opens the home page',
    'When a plus-address email is submitted for subscription',
    'Then the subscription is accepted'
  ],
  HOME007: [
    'Given a visitor scrolls to the footer',
    'When the scroll-up control is used',
    'Then the top hero content is visible again'
  ],
  HOME008: [
    'Given a visitor scrolls down the home page',
    'When the visitor scrolls back to the top manually',
    'Then the top hero content is visible again'
  ],
  HOME009: [
    'Given a visitor opens the home page',
    'When the page is refreshed',
    'Then the home page remains loaded'
  ],
  HOME010: [
    'Given a visitor navigates from home to products',
    'When browser back returns to the home page',
    'Then the home page remains loaded'
  ],
  NAV001: [
    'Given a visitor opens the site',
    'When the Test Cases navigation link is selected',
    'Then the test cases page is displayed'
  ],
  NAV002: [
    'Given a visitor opens the site',
    'When the API Testing navigation link is selected',
    'Then the static API testing page is displayed'
  ],
  NAV003: [
    'Given a visitor reviews external learning navigation',
    'When the Video Tutorials link is inspected',
    'Then it points to the expected YouTube channel'
  ],
  CHECKOUT001: [
    'Given a registered shopper has a product in the cart',
    'When the shopper completes checkout and payment',
    'Then the order is placed successfully',
    'And the created account is removed as cleanup'
  ],
  CHECKOUT002: [
    'Given a registered shopper has multiple products in the cart',
    'When the shopper reviews checkout before payment',
    'Then both products remain visible for order review'
  ],
  CHECKOUT003: [
    'Given a guest shopper has a product in the cart',
    'When checkout is attempted',
    'Then the shopper is asked to register or log in'
  ],
  CHECKOUT004: [
    'Given a guest shopper starts checkout with a product in the cart',
    'When the shopper registers during checkout',
    'Then the cart is preserved and the order can be placed'
  ],
  CHECKOUT005: [
    'Given a returning customer logs in before checkout',
    'When the customer completes checkout and payment',
    'Then the order is placed successfully'
  ],
  CHECKOUT006: [
    'Given a registered shopper reaches payment',
    'When payment is submitted without cardholder details',
    'Then browser validation blocks payment'
  ],
  CHECKOUT007: [
    'Given a registered shopper reaches checkout',
    'When a long order comment is submitted',
    'Then the shopper can continue to payment'
  ],
  CHECKOUT008: [
    'Given a registered shopper reaches checkout',
    'When address details are reviewed',
    'Then delivery and billing addresses match registration data'
  ],
  CHECKOUT009: [
    'Given a registered shopper places an order',
    'When the invoice is downloaded',
    'Then the downloaded file is identified as an invoice'
  ],
  CHECKOUT010: [
    'Given a registered shopper reaches checkout',
    'When the checkout page is refreshed',
    'Then address and order review remain available'
  ],
  CHECKOUT011: [
    'Given a registered shopper reaches payment',
    'When browser back returns to checkout',
    'Then address and order review remain available'
  ],
  CHECKOUT012: [
    'Given checkout state exists in browser storage',
    'When a new browser context is opened with that storage',
    'Then checkout can be restored'
  ]
};
