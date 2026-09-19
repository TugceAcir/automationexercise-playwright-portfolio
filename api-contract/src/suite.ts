import path from 'node:path';

// The two API suites. `read` is the shipped, read-only Phase 1 suite and the default; `lifecycle`
// writes to generated accounts and only ever runs when explicitly selected.
export const SUITES = ['read', 'lifecycle'] as const;
export type Suite = (typeof SUITES)[number];

export const SUITE_TEST_DIRS: Record<Suite, string> = {
  read: 'tests/api',
  lifecycle: 'tests/lifecycle'
};

/** Every test carries exactly one of these, and it must match the suite it lives in. */
export const SUITE_TAGS: Record<Suite, '@read' | '@write'> = {
  read: '@read',
  lifecycle: '@write'
};

export function resolveSuite(raw: string | undefined = process.env.API_SUITE): Suite {
  const suite = raw ?? 'read';

  if (!(SUITES as readonly string[]).includes(suite)) {
    throw new Error(`API_SUITE must be one of ${SUITES.join(', ')}. Received: ${suite}`);
  }

  return suite as Suite;
}

const packageRoot = path.resolve(__dirname, '..');

export function suiteResultsDir(suite: Suite): string {
  return path.join(packageRoot, 'results', suite);
}
