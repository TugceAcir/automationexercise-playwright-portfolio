import type { z } from 'zod';
import { ContractFailure } from './classification';
import { brandListSchema, messageSchema, productListSchema } from './schemas';
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

  // Only for endpoints verified (2026-09-19) to refuse the method outright, so the refusal is
  // side-effect free and retry-safe.
  async sendUnsupportedMethod(method: Exclude<HttpMethod, 'GET'>, path: string): Promise<ApiResult<MessageResponse>> {
    const response = await this.transport.send({ method, path, retrySafe: true });

    return parseContract(messageSchema, response, `${method} ${path}`);
  }
}
