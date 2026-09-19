import { test as base } from '@playwright/test';
import { ApiClient } from './client';
import { ApiTransport } from './transport';

type ApiFixtures = {
  api: ApiClient;
};

export const test = base.extend<ApiFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(new ApiTransport(request)));
  }
});

export { expect } from '@playwright/test';
