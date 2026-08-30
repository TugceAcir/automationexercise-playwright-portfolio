import { BOT_CHALLENGE_ERROR, DEMO_SITE_ERROR_PATTERN, TRANSIENT_DEMO_SITE_ERROR, isBotChallenge } from '../shared/demo-site-classification';
import { resolveBaseUrl } from '../shared/base-url';

const PREFLIGHT_TIMEOUT_MS = 15_000;
const DEFAULT_DIAGNOSTIC_PROBE_DELAY_MS = 5_000;

// Read at call time so tests can collapse the wait without stubbing timers.
function diagnosticProbeDelayMs(): number {
  const override = Number(process.env.PREFLIGHT_PROBE_DELAY_MS);

  return Number.isFinite(override) && override >= 0 ? override : DEFAULT_DIAGNOSTIC_PROBE_DELAY_MS;
}

// The preflight guards a suite that drives real browsers, so it should look like one.
// A bare fetch sends Node's own user agent, which is the shape bot protection exists to
// challenge — making the check more likely to be blocked than the run it protects.
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9'
} as const;

type ProbeResult = { status: number; body: string };

async function probe(baseUrl: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

  try {
    const response = await fetch(baseUrl, { signal: controller.signal, headers: BROWSER_HEADERS });

    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timeout);
  }
}

// Every recovery from a bot challenge so far has come from a *new* runner with a new IP,
// and no same-IP retry has ever been attempted — so we do not know whether retrying in
// place would help. This probe answers that from real runs. It only records what a retry
// would have found; the preflight still fails, so the gate is unchanged.
async function recordRetryEvidence(baseUrl: string): Promise<void> {
  const delayMs = diagnosticProbeDelayMs();
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  try {
    const { status, body } = await probe(baseUrl);
    const stillChallenged = isBotChallenge(body);

    console.error(
      `Diagnostic re-probe from the same runner after ${delayMs}ms: HTTP ${status}, ` +
        `challenge ${stillChallenged ? 'still present' : 'cleared'}. This does not affect the preflight result.`
    );
  } catch (error: unknown) {
    console.error(`Diagnostic re-probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runDemoSitePreflight(rawBaseUrl = process.env.BASE_URL): Promise<void> {
  const baseUrl = resolveBaseUrl(rawBaseUrl);
  const { status, body } = await probe(baseUrl);

  if (isBotChallenge(body)) {
    await recordRetryEvidence(baseUrl);
    throw new Error(BOT_CHALLENGE_ERROR);
  }

  if (!body.trim() || DEMO_SITE_ERROR_PATTERN.test(body) || status >= 500) {
    throw new Error(`${TRANSIENT_DEMO_SITE_ERROR} Preflight status: ${status}.`);
  }

  console.log(`Demo-site preflight passed for ${baseUrl} with HTTP ${status}.`);
}

if (require.main === module) {
  void runDemoSitePreflight().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`Demo-site preflight failed: ${message}`);
    process.exitCode = 1;
  });
}
