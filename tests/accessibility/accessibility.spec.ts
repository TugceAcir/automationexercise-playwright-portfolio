import AxeBuilder from '@axe-core/playwright';
import type { AxeResults, Result } from 'axe-core';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../fixtures/pages.fixture';
import { products } from '../../test-data/products';
import { createTestUser } from '../../test-data/user.factory';
import { addProductsAndOpenCart, deleteAccountIfPresent, registerCustomer } from '../support/test-actions';
import { accessibilityBaseline } from './accessibility-baseline';
import { compareRuleIds } from './baseline-policy';

const wcag21LevelAAndAA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function formatViolation(state: string, violation: Result): string {
  const nodes = violation.nodes.map((node) => node.target.join(' ')).join(', ');
  return [
    `[${state}] ${violation.id} (${violation.impact ?? 'impact unknown'})`,
    violation.description,
    `Affected nodes: ${nodes}`,
    `Help: ${violation.helpUrl}`
  ].join('\n');
}

async function expectNoAccessibilityRegression(
  state: keyof typeof accessibilityBaseline,
  results: AxeResults,
  attach: (name: string, options: { body: string; contentType: string }) => Promise<void>
): Promise<void> {
  const currentByRule = new Map(results.violations.map((violation) => [violation.id, violation]));
  const comparison = compareRuleIds([...currentByRule.keys()], accessibilityBaseline[state]);
  const newViolations = comparison.newRuleIds.map((ruleId) => currentByRule.get(ruleId)).filter((violation): violation is Result => violation !== undefined);

  console.log(`[a11y fingerprint] ${state}: ${[...currentByRule.keys()].sort().join(', ') || 'none'}`);

  await attach(`axe-${state}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json'
  });

  if (comparison.removedRuleIds.length > 0) {
    console.warn(`[a11y baseline] ${state}: resolved rule IDs (review baseline, run remains passing): ${comparison.removedRuleIds.join(', ')}`);
  }

  expect(
    newViolations.map((violation) => violation.id),
    newViolations.map((violation) => formatViolation(state, violation)).join('\n\n')
  ).toEqual([]);
}

async function scan(state: keyof typeof accessibilityBaseline, page: Page, testInfo: TestInfo): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(wcag21LevelAAndAA).analyze();
  await expectNoAccessibilityRegression(state, results, testInfo.attach.bind(testInfo));
}

test.describe('WCAG 2.1 A/AA accessibility baseline', () => {
  test('home page', async ({ page, homePage }, testInfo) => {
    await homePage.open();
    await homePage.expectLoaded();
    await scan('home', page, testInfo);
  });

  test('product listing search results', async ({ page, productsPage }, testInfo) => {
    await productsPage.open();
    await productsPage.searchFor(products.blueTop.name);
    await productsPage.expectSearchResultsFor(products.blueTop.name);
    await scan('product-listing', page, testInfo);
  });

  test('product detail page', async ({ page, productDetailPage }, testInfo) => {
    await productDetailPage.open(products.blueTop.id);
    await scan('product-detail', page, testInfo);
  });

  test('cart containing a product', async ({ page, cartPage }, testInfo) => {
    await addProductsAndOpenCart(page, [products.blueTop.id]);
    await cartPage.expectCartPage();
    await cartPage.expectProduct(products.blueTop.name);
    await scan('cart', page, testInfo);
  });

  test('authenticated checkout with a seeded cart', async ({ page, cartPage, checkoutPage }, testInfo) => {
    const user = createTestUser('a11y-checkout');

    try {
      await registerCustomer(page, user);
      await addProductsAndOpenCart(page, [products.blueTop.id]);
      await cartPage.proceedToCheckout();
      await checkoutPage.expectAddressAndOrderReview();
      await scan('checkout', page, testInfo);
    } finally {
      await deleteAccountIfPresent(page, user);
    }
  });
});
