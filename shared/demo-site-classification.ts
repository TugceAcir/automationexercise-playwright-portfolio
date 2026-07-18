export type FailureCauseGroup = 'environment' | 'other';

export const DEMO_SITE_ERROR_PATTERN =
  /500 Internal Server Error|503 Service Unavailable|Error code (?:503|520)|queue full|too many people are accessing this website|Web server is returning an unknown error/i;

export const BOT_CHALLENGE_PHRASES = ['One moment, please', 'Just a moment', 'Checking your browser', 'Verify you are human'];
export const BOT_CHALLENGE_ERROR = 'Automation Exercise served a bot-challenge page to the test runner.';
export const TRANSIENT_DEMO_SITE_ERROR = 'Automation Exercise returned a transient server/load error page.';
export const UNCERTAIN_ACCOUNT_CREATION_ERROR =
  'The account-creation request was submitted, but the demo site returned a transient error page. The account outcome is uncertain; the request was not repeated.';

export function classifyFailureCause(errorText: string): FailureCauseGroup {
  return isEnvironmentFailure(errorText) ? 'environment' : 'other';
}

export function isEnvironmentFailure(errorText: string): boolean {
  return (
    DEMO_SITE_ERROR_PATTERN.test(errorText) ||
    isBotChallenge(errorText) ||
    errorText.includes(BOT_CHALLENGE_ERROR) ||
    errorText.includes(TRANSIENT_DEMO_SITE_ERROR) ||
    errorText.includes(UNCERTAIN_ACCOUNT_CREATION_ERROR)
  );
}

export function isBotChallenge(text: string): boolean {
  const normalizedText = text.toLowerCase();

  return BOT_CHALLENGE_PHRASES.some((phrase) => normalizedText.includes(phrase.toLowerCase()));
}
