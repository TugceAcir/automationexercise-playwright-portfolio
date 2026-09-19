import type { APIRequestContext } from '@playwright/test';
import { ContractFailure, EnvironmentFailure, isBotChallenge, isTransientPage } from './classification';

// The only module allowed to call APIRequestContext (enforced by eslint.config.mjs). It owns the
// three decisions every request needs: how to read the body, whether a bad answer is the site's
// fault or the contract's, and whether one retry is safe.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ApiRequest = {
  method: HttpMethod;
  path: string;
  form?: Record<string, string>;
  /** Only a request that changes nothing on the server may be repeated. Defaults to false. */
  retrySafe?: boolean;
};

export type ApiResponse = {
  httpStatus: number;
  body: unknown;
};

export type RawResponse = { status: number; text: string };

type Interpreted = ApiResponse | { transient: string };

const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;

// Read at call time so unit tests can collapse the wait without stubbing timers.
function retryDelayMs(): number {
  const override = Number(process.env.API_RETRY_DELAY_MS);

  return Number.isFinite(override) && override >= 0 ? override : DEFAULT_RETRY_DELAY_MS;
}

function label(request: ApiRequest): string {
  return `${request.method} ${request.path}`;
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

// A 5xx counts as a confirmed transient failure only when its body is not the API's own JSON:
// a JSON 5xx is the application answering, and belongs to the contract assertions instead.
function transientReason(raw: RawResponse, isJson: boolean): string | undefined {
  if (isJson) {
    return undefined;
  }

  if (isTransientPage(raw.text)) {
    return `known transient load/error page (HTTP ${raw.status})`;
  }

  if (raw.status >= 500) {
    return `HTTP ${raw.status} with a non-JSON body`;
  }

  return undefined;
}

export function interpretResponse(request: ApiRequest, raw: RawResponse): Interpreted {
  // The live API labels its JSON as text/html (verified 2026-09-19), so Content-Type is
  // ignored and the body is parsed regardless.
  const parsed = tryParseJson(raw.text);

  if (!parsed.ok && isBotChallenge(raw.text)) {
    throw new EnvironmentFailure(`${label(request)} was answered with a bot-challenge page (HTTP ${raw.status}).`);
  }

  const transient = transientReason(raw, parsed.ok);

  if (transient) {
    return { transient };
  }

  if (!parsed.ok) {
    const preview = raw.text.trim().slice(0, 120).replace(/\s+/g, ' ');
    const kind = /^\s*</.test(raw.text) ? 'an unrecognised HTML page' : 'malformed JSON';

    throw new ContractFailure(`${label(request)} returned ${kind} (HTTP ${raw.status}): ${preview || '<empty body>'}`);
  }

  return { httpStatus: raw.status, body: parsed.value };
}

export type Fetcher = (request: ApiRequest) => Promise<RawResponse>;

export class ApiTransport {
  private readonly fetchRaw: Fetcher;

  // Accepts a Fetcher so the retry and classification rules can be unit-tested offline.
  constructor(source: APIRequestContext | Fetcher) {
    this.fetchRaw = typeof source === 'function' ? source : playwrightFetcher(source);
  }

  async send(apiRequest: ApiRequest): Promise<ApiResponse> {
    const first = interpretResponse(apiRequest, await this.fetchRaw(apiRequest));

    if (!('transient' in first)) {
      return first;
    }

    if (!apiRequest.retrySafe) {
      throw new EnvironmentFailure(`${label(apiRequest)} hit a ${first.transient}. It is not retry-safe, so it was not repeated.`);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs()));
    const second = interpretResponse(apiRequest, await this.fetchRaw(apiRequest));

    if ('transient' in second) {
      throw new EnvironmentFailure(`${label(apiRequest)} hit a ${first.transient}, and again on its single retry: ${second.transient}.`);
    }

    return second;
  }
}

function playwrightFetcher(context: APIRequestContext): Fetcher {
  return async (apiRequest) => {
    const response = await context.fetch(apiRequest.path, {
      method: apiRequest.method,
      form: apiRequest.form,
      failOnStatusCode: false,
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS
    });

    return { status: response.status(), text: await response.text() };
  };
}
