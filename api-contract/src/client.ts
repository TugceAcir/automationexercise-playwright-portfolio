import type { z } from 'zod';
import { ContractFailure } from './classification';
import { brandListSchema, messageSchema, productListSchema, responseCodeSchema } from './schemas';
import type { BrandList, MessageResponse, ProductList } from './schemas';
import type { ApiResponse, ApiTransport, HttpMethod } from './transport';

// What a caller can ask the API. Each method names its endpoint once and validates the body
// against its schema, so specs assert behaviour (responseCode, message, content) and never
// re-describe the shape.

export type ApiResult<T> = { httpStatus: number; body: T };

export function parseContract<S extends z.ZodType>(schema: S, response: ApiResponse, label: string): ApiResult<z.infer<S>> {
  const result = schema.safeParse(response.body);

  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');

    throw new ContractFailure(`${label} did not match its schema: ${issues}`);
  }

  return { httpStatus: response.httpStatus, body: result.data };
}

export class ApiClient {
  constructor(private readonly transport: ApiTransport) {}

  async productsList(): Promise<ApiResult<ProductList>> {
    const response = await this.transport.send({ method: 'GET', path: '/api/productsList', retrySafe: true });

    return parseContract(productListSchema, response, 'GET /api/productsList');
  }

  async brandsList(): Promise<ApiResult<BrandList>> {
    const response = await this.transport.send({ method: 'GET', path: '/api/brandsList', retrySafe: true });

    return parseContract(brandListSchema, response, 'GET /api/brandsList');
  }

  // searchProduct is a POST that only reads, so it is retry-safe.
  async searchProducts(term: string): Promise<ApiResult<ProductList>> {
    const response = await this.transport.send({ method: 'POST', path: '/api/searchProduct', form: { search_product: term }, retrySafe: true });

    return parseContract(productListSchema, response, 'POST /api/searchProduct');
  }

  async searchProductsWithoutTerm(): Promise<ApiResult<MessageResponse>> {
    const response = await this.transport.send({ method: 'POST', path: '/api/searchProduct', retrySafe: true });

    return parseContract(messageSchema, response, 'POST /api/searchProduct without search_product');
  }

  // verifyLogin only checks credentials and changes nothing. Phase 1 never sends a real account.
  async verifyLogin(credentials: { email?: string; password?: string }): Promise<ApiResult<MessageResponse>> {
    const form: Record<string, string> = {};

    if (credentials.email !== undefined) form.email = credentials.email;
    if (credentials.password !== undefined) form.password = credentials.password;

    const response = await this.transport.send({ method: 'POST', path: '/api/verifyLogin', form, retrySafe: true });

    return parseContract(messageSchema, response, 'POST /api/verifyLogin');
  }

  // getUserDetailByEmail is a read. Its found-account body is a user record whose schema is
  // deliberately not written until Part B's live discovery; these two methods cover only what
  // was verified on 2026-09-19 (400 without an email, 404 for an unknown one).
  async lookupAccountRefusal(email?: string): Promise<ApiResult<MessageResponse>> {
    const query = email === undefined ? undefined : { email };
    const response = await this.transport.send({ method: 'GET', path: '/api/getUserDetailByEmail', query, retrySafe: true });

    return parseContract(messageSchema, response, 'GET /api/getUserDetailByEmail');
  }

  /**
   * The read every write proof relies on: does an account exist for this email? Anything but
   * the two verified codes is a contract failure, which a write proof treats as "unknown".
   */
  async accountPresence(email: string): Promise<'present' | 'absent'> {
    const response = await this.transport.send({ method: 'GET', path: '/api/getUserDetailByEmail', query: { email }, retrySafe: true });
    const { body } = parseContract(responseCodeSchema, response, 'GET /api/getUserDetailByEmail (presence)');

    if (body.responseCode === 200) return 'present';
    if (body.responseCode === 404) return 'absent';

    throw new ContractFailure(`GET /api/getUserDetailByEmail answered responseCode ${body.responseCode}; expected 200 (present) or 404 (absent).`);
  }

  // Only for endpoints verified (2026-09-19) to refuse the method outright, so the refusal is
  // side-effect free and retry-safe.
  async sendUnsupportedMethod(method: Exclude<HttpMethod, 'GET'>, path: string): Promise<ApiResult<MessageResponse>> {
    const response = await this.transport.send({ method, path, retrySafe: true });

    return parseContract(messageSchema, response, `${method} ${path}`);
  }
}
