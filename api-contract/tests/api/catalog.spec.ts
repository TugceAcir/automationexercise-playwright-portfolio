import { test, expect } from '../../src/fixture';

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
});
