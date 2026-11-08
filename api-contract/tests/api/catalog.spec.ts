import { test, expect } from '../../src/fixture';
// Deliberate one-way, test-only read of the UI side, like the classifier parity test.
// That file has no imports of its own, and no API runtime code ever imports it.
import { products as uiProducts } from '../../../test-data/products';

test.describe('Catalog API', () => {
  test('@API001 @api @read @catalog @smoke product list returns every product with a documented shape', async ({ api }) => {
    const { body } = await api.productsList();

    expect(body.responseCode).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);

    const ids = body.products.map((product) => product.id);
    expect(new Set(ids).size, 'product ids must be unique').toBe(ids.length);
  });

  test('@API002 @api @read @catalog @smoke brand list returns every brand with a documented shape', async ({ api }) => {
    const { body } = await api.brandsList();

    expect(body.responseCode).toBe(200);
    expect(body.brands.length).toBeGreaterThan(0);
    expect(body.brands.every((brand) => brand.brand.trim().length > 0)).toBe(true);
  });

  // The UI suite asserts these records in many browser tests. If the site changes one, this
  // single check names the drifted record, so the browser failures can be classified as data.
  test('@API013 @api @read @catalog @regression the product records the UI suite relies on match the live catalog', async ({ api }) => {
    const { body } = await api.productsList();

    expect(body.responseCode).toBe(200);

    for (const [key, expected] of Object.entries(uiProducts)) {
      const live = body.products.find((product) => product.id === expected.id);

      expect.soft(
        live && { id: live.id, name: live.name, price: live.price },
        `test-data/products.ts "${key}" no longer matches the live catalog - update the test data, not the UI tests`
      ).toEqual({ id: expected.id, name: expected.name, price: expected.price });
    }
  });
});
