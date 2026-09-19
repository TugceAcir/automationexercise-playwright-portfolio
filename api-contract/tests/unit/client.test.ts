import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTRACT_MARKER } from '../../src/classification';
import { ApiClient, parseContract } from '../../src/client';
import { productListSchema } from '../../src/schemas';
import { ApiTransport } from '../../src/transport';
import type { ApiRequest } from '../../src/transport';

const PRODUCT = { id: 1, name: 'Blue Top', price: 'Rs. 500', brand: 'Polo', category: { usertype: { usertype: 'Women' }, category: 'Tops' } };

test('an extra unknown field does not break the contract', () => {
  const result = parseContract(productListSchema, { httpStatus: 200, body: { responseCode: 200, products: [{ ...PRODUCT, rating: 5 }], page: 1 } }, 'products');

  assert.equal(result.body.products[0].name, 'Blue Top');
});

test('a missing required field is a contract failure that names the field', () => {
  const withoutPrice: Partial<typeof PRODUCT> = { ...PRODUCT };
  delete withoutPrice.price;

  assert.throws(
    () => parseContract(productListSchema, { httpStatus: 200, body: { responseCode: 200, products: [withoutPrice] } }, 'products'),
    (error: Error) => error.message.startsWith(CONTRACT_MARKER) && error.message.includes('products.0.price')
  );
});

test('a wrongly typed field is a contract failure', () => {
  assert.throws(
    () => parseContract(productListSchema, { httpStatus: 200, body: { responseCode: 200, products: [{ ...PRODUCT, id: '1' }] } }, 'products'),
    (error: Error) => error.message.startsWith(CONTRACT_MARKER) && error.message.includes('products.0.id')
  );
});

test('the client sends only the credentials it is given, and marks reads retry-safe', async () => {
  const sent: ApiRequest[] = [];
  const client = new ApiClient(
    new ApiTransport(async (request) => {
      sent.push(request);

      return { status: 200, text: '{"responseCode": 400, "message": "Bad request"}' };
    })
  );

  await client.verifyLogin({ password: 'x' });
  await client.searchProducts('top').catch(() => undefined);

  assert.deepEqual(sent[0], { method: 'POST', path: '/api/verifyLogin', form: { password: 'x' }, retrySafe: true });
  assert.deepEqual(sent[1].form, { search_product: 'top' });
  assert.equal(sent.every((request) => request.retrySafe === true), true);
});
