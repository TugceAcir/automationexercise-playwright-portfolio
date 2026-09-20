import type { z } from 'zod';
import { ContractFailure, EnvironmentFailure } from './classification';
import { brandListSchema, messageSchema, productListSchema, responseCodeSchema, userDetailSchema } from './schemas';
import type { BrandList, MessageResponse, ProductList, UserDetail } from './schemas';
import { LOOKUP_FIELD_BY_FORM_FIELD, accountForm, unprovableFields } from './test-user';
import type { GeneratedAccount } from './test-user';
import type { ApiRequest, ApiResponse, ApiTransport, HttpMethod } from './transport';
import { performAndProveWrite } from './write-proof';
import type { ProvenState, WriteOutcome } from './write-proof';

// What a caller can ask the API. Each method names its endpoint once and validates the body
// against its schema, so specs assert behaviour (responseCode, message, content) and never
// re-describe the shape.

export type ApiResult<T> = { httpStatus: number; body: T };

/**
 * The outcome of a lifecycle write. `answered` carries the API's own body to assert.
 * `proven-committed` means the answer was lost but a read proved the change landed, so there is
 * no documented body to check - the spec asks for the answer explicitly with `requireAnswer`.
 */
export type WriteResult =
  | { kind: 'answered'; httpStatus: number; body: MessageResponse; attempts: number }
  | { kind: 'proven-committed'; reason: string; attempts: number };

/**
 * The body of a write that answered. A write that only proved itself is an environment problem,
 * not a contract one: the state is correct but the documented answer never arrived, so the
 * assertion cannot be made and must not be reported as a contract failure.
 */
export function requireAnswer(result: WriteResult, label: string): { httpStatus: number; body: MessageResponse } {
  if (result.kind === 'answered') {
    return { httpStatus: result.httpStatus, body: result.body };
  }

  throw new EnvironmentFailure(`${label} took effect, but its answer was lost (${result.reason}), so the documented response could not be asserted.`);
}

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

  /** The full account record for an email that exists. Verified shape; see userAccountSchema. */
  async lookupAccount(email: string): Promise<ApiResult<UserDetail>> {
    const response = await this.transport.send({ method: 'GET', path: '/api/getUserDetailByEmail', query: { email }, retrySafe: true });

    return parseContract(userDetailSchema, response, 'GET /api/getUserDetailByEmail (account)');
  }

  // Every lifecycle write goes through here, so none of them can skip the proof policy.
  private async runWrite(write: { label: string; request: ApiRequest; prove: () => Promise<ProvenState>; replayWhenNotCommitted: boolean }): Promise<WriteResult> {
    const outcome: WriteOutcome = await performAndProveWrite({
      label: write.label,
      send: () => this.transport.sendWrite(write.request),
      prove: write.prove,
      replayWhenNotCommitted: write.replayWhenNotCommitted
    });

    if (outcome.kind === 'proven-committed') {
      return outcome;
    }

    const parsed = parseContract(messageSchema, outcome.response, write.label);

    return { kind: 'answered', httpStatus: parsed.httpStatus, body: parsed.body, attempts: outcome.attempts };
  }

  /** Create is never replayed: a second create racing a slow first one is the duplicate this avoids. */
  async createAccount(account: GeneratedAccount): Promise<WriteResult> {
    return this.runWrite({
      label: `Creating account ${account.email}`,
      request: { method: 'POST', path: '/api/createAccount', form: accountForm(account) },
      prove: async () => ((await this.accountPresence(account.email)) === 'present' ? 'committed' : 'not-committed'),
      replayWhenNotCommitted: false
    });
  }

  /**
   * Update, proven by reading the changed fields back. `changes` are form field names; the
   * lookup answers under different names for some of them (LOOKUP_FIELD_BY_FORM_FIELD).
   * A change the lookup cannot report back is refused here rather than pretended to be proven.
   */
  async updateAccount(account: GeneratedAccount, options: { changes: Record<string, string>; password?: string }): Promise<WriteResult> {
    const { changes, password } = options;

    if (Object.keys(changes).length === 0) {
      throw new Error('updateAccount needs at least one changed field, otherwise the update cannot be proven.');
    }

    const unprovable = unprovableFields(changes);

    if (unprovable.length > 0) {
      throw new Error(`The account lookup does not report ${unprovable.join(', ')}, so an update to it cannot be proven.`);
    }

    const form = { ...accountForm(account), ...changes, ...(password === undefined ? {} : { password }) };

    return this.runWrite({
      label: `Updating account ${account.email}`,
      request: { method: 'PUT', path: '/api/updateAccount', form },
      // A refused update (wrong password) simply never lands, so this proof reads not-committed
      // and the write is repeated at most once. A repeated refusal changes nothing.
      prove: async () => ((await this.accountMatches(account.email, changes)) ? 'committed' : 'not-committed'),
      replayWhenNotCommitted: true
    });
  }

  async deleteAccount(credentials: { email: string; password: string }): Promise<WriteResult> {
    return this.runWrite({
      label: `Deleting account ${credentials.email}`,
      request: { method: 'DELETE', path: '/api/deleteAccount', form: credentials },
      prove: async () => ((await this.accountPresence(credentials.email)) === 'absent' ? 'committed' : 'not-committed'),
      replayWhenNotCommitted: true
    });
  }

  /** Does the stored account already carry these form-field changes? */
  async accountMatches(email: string, changes: Record<string, string>): Promise<boolean> {
    const { body } = await this.lookupAccount(email);
    const stored = body.user as unknown as Record<string, unknown>;

    return Object.entries(changes).every(([field, value]) => stored[LOOKUP_FIELD_BY_FORM_FIELD[field]] === value);
  }

  // Only for endpoints verified (2026-09-19) to refuse the method outright, so the refusal is
  // side-effect free and retry-safe.
  async sendUnsupportedMethod(method: Exclude<HttpMethod, 'GET'>, path: string): Promise<ApiResult<MessageResponse>> {
    const response = await this.transport.send({ method, path, retrySafe: true });

    return parseContract(messageSchema, response, `${method} ${path}`);
  }
}
