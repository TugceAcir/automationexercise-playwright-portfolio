export const DEFAULT_BASE_URL = 'https://automationexercise.com/';

export function resolveBaseUrl(rawBaseUrl = process.env.BASE_URL ?? DEFAULT_BASE_URL): string {
  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error(`BASE_URL must be a valid http(s) URL. Received: ${rawBaseUrl}`);
  }

  if (parsedBaseUrl.protocol !== 'http:' && parsedBaseUrl.protocol !== 'https:') {
    throw new Error(`BASE_URL must use http or https. Received protocol: ${parsedBaseUrl.protocol}`);
  }

  return parsedBaseUrl.toString();
}
