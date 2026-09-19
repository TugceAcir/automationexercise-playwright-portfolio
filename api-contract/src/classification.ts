// A package-local copy of the bot/transient rules in the UI's shared/demo-site-classification.ts.
// The API runtime never imports the UI file; tests/unit/classification-parity.test.ts compares
// the two over fixed sample pages so the copies cannot drift apart unnoticed.
export const DEMO_SITE_ERROR_PATTERN =
  /500 Internal Server Error|503 Service Unavailable|Error code (?:503|520)|queue full|too many people are accessing this website|Web server is returning an unknown error/i;

export const BOT_CHALLENGE_PHRASES = ['One moment, please', 'Just a moment', 'Checking your browser', 'Verify you are human'];

// Prefixes the summary script reads to split failures. Only a failure tagged environment is
// ever counted as the site's fault.
export const ENVIRONMENT_MARKER = '[api-environment]';
export const CONTRACT_MARKER = '[api-contract]';

// Copied, not imported, from the UI's shared/demo-site-classification.ts: the same situation (a
// state-changing request answered by a transient page, and the outcome could not be proven)
// reads the same way in both layers.
export const UNCERTAIN_ACTION_OUTCOME_ERROR =
  'The demo site returned a transient error page after a state-changing action, and whether the action took effect could not be established. It was not repeated.';

export function isBotChallenge(text: string): boolean {
  const normalizedText = text.toLowerCase();

  return BOT_CHALLENGE_PHRASES.some((phrase) => normalizedText.includes(phrase.toLowerCase()));
}

export function isTransientPage(text: string): boolean {
  return DEMO_SITE_ERROR_PATTERN.test(text);
}

/** The demo site, not the API contract, stopped the request: a bot page, a load page, or a confirmed transient 5xx. */
export class EnvironmentFailure extends Error {
  constructor(message: string) {
    super(`${ENVIRONMENT_MARKER} ${message}`);
    this.name = 'EnvironmentFailure';
  }
}

/** The API answered, but not in the documented shape: malformed JSON, unknown HTML, or a schema violation. */
export class ContractFailure extends Error {
  constructor(message: string) {
    super(`${CONTRACT_MARKER} ${message}`);
    this.name = 'ContractFailure';
  }
}
