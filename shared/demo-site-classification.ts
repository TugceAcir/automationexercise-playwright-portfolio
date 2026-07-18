export type FailureCauseGroup = 'environment' | 'other';

export const DEMO_SITE_ERROR_PATTERN =
  /500 Internal Server Error|503 Service Unavailable|Error code (?:503|520)|queue full|too many people are accessing this website|Web server is returning an unknown error/i;

export const TRANSIENT_DEMO_SITE_ERROR = 'Automation Exercise returned a transient server/load error page.';
export const UNCERTAIN_ACCOUNT_CREATION_ERROR =
  'The account-creation request was submitted, but the demo site returned a transient error page. The account outcome is uncertain; the request was not repeated.';

export function classifyFailureCause(errorText: string): FailureCauseGroup {
  return isEnvironmentFailure(errorText) ? 'environment' : 'other';
}

export function isEnvironmentFailure(errorText: string): boolean {
  return (
    DEMO_SITE_ERROR_PATTERN.test(errorText) ||
    errorText.includes(TRANSIENT_DEMO_SITE_ERROR) ||
    errorText.includes(UNCERTAIN_ACCOUNT_CREATION_ERROR)
  );
}
