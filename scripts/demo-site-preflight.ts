import { BOT_CHALLENGE_ERROR, DEMO_SITE_ERROR_PATTERN, TRANSIENT_DEMO_SITE_ERROR, isBotChallenge } from '../shared/demo-site-classification';

const DEFAULT_BASE_URL = 'https://automationexercise.com';
const PREFLIGHT_TIMEOUT_MS = 15_000;

export async function runDemoSitePreflight(baseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

  try {
    const response = await fetch(baseUrl, { signal: controller.signal });
    const body = await response.text();

    if (isBotChallenge(body)) {
      throw new Error(BOT_CHALLENGE_ERROR);
    }

    if (!body.trim() || DEMO_SITE_ERROR_PATTERN.test(body) || response.status >= 500) {
      throw new Error(`${TRANSIENT_DEMO_SITE_ERROR} Preflight status: ${response.status}.`);
    }

    console.log(`Demo-site preflight passed for ${baseUrl} with HTTP ${response.status}.`);
  } finally {
    clearTimeout(timeout);
  }
}

if (require.main === module) {
  void runDemoSitePreflight().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`Demo-site preflight failed: ${message}`);
    process.exitCode = 1;
  });
}
