import type { BrowserContext, Page } from '@playwright/test';

export const thirdPartyNoisePattern = /.*(googlesyndication|doubleclick|googleadservices|adservice|adsystem|fundingchoices).*/;

export async function blockThirdPartyNoise(target: BrowserContext | Page): Promise<void> {
  await target.route(thirdPartyNoisePattern, async (route) => {
    await route.abort();
  });
}
