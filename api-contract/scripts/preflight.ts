import { resolveBaseUrl } from '../src/base-url';
import { isBotChallenge, isTransientPage } from '../src/classification';

// One read-only request before the suite: if the site is serving a bot or load page, stop here
// with an environment message instead of letting ten tests fail on the same cause.
const PREFLIGHT_PATH = 'api/brandsList';
const PREFLIGHT_TIMEOUT_MS = 15_000;

export async function runApiPreflight(rawBaseUrl = process.env.BASE_URL): Promise<void> {
  const url = new URL(PREFLIGHT_PATH, resolveBaseUrl(rawBaseUrl)).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);
  let status: number;
  let body: string;

  try {
    const response = await fetch(url, { signal: controller.signal });
    status = response.status;
    body = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  if (isBotChallenge(body)) {
    throw new Error(`API preflight: ${url} served a bot-challenge page (HTTP ${status}).`);
  }

  if (!body.trim() || isTransientPage(body) || status >= 500) {
    throw new Error(`API preflight: ${url} returned a transient server/load response (HTTP ${status}).`);
  }

  console.log(`API preflight passed for ${url} with HTTP ${status}.`);
}

if (require.main === module) {
  void runApiPreflight().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
