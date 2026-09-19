import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixture';

test.describe('Product search API', () => {
  test('@API003 @api @search @smoke valid search returns only products matching the term', async ({ api }) => {
    const term = 'top';
    const { body } = await api.searchProducts(term);

    expect(body.responseCode).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);

    // The site matches on product name or category name (verified 2026-09-19: "Little Girls
    // Mr. Panda Shirt" is returned for "top" through its "Tops & Shirts" category).
    const unrelated = body.products.filter(
      (product) => !`${product.name} ${product.category.category}`.toLowerCase().includes(term)
    );
    expect(unrelated.map((product) => product.name)).toEqual([]);
  });

  test('@API004 @api @search @negative search without its parameter is refused as a bad request', async ({ api }) => {
    const { body } = await api.searchProductsWithoutTerm();

    expect(body.responseCode).toBe(400);
    expect(body.message).toBe('Bad request, search_product parameter is missing in POST request.');
  });

  test('@API005 @api @search @edge search for a term that cannot exist returns an empty list', async ({ api }) => {
    // A fresh UUID cannot be a substring of any product or category name.
    const { body } = await api.searchProducts(`no-such-product-${randomUUID()}`);

    expect(body.responseCode).toBe(200);
    expect(body.products).toEqual([]);
  });
});
