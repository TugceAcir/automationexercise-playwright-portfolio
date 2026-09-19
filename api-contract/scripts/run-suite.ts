import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveSuite, suiteResultsDir } from '../src/suite';

// `npm run test:api` / `npm run test:lifecycle`. Clears the suite's previous results, so nothing
// from an earlier run can be read as this run's evidence, records a fresh run ID that the
// lifecycle cleanup record must match, then runs Playwright for that suite only.

export type RunMetadata = { suite: string; runId: string; startedAt: string };

export const RUN_METADATA_FILE = 'run.json';

function main(): void {
  const [rawSuite, ...playwrightArgs] = process.argv.slice(2);
  const suite = resolveSuite(rawSuite);
  const resultsDir = suiteResultsDir(suite);
  const runId = process.env.API_RUN_ID ?? randomUUID();

  rmSync(resultsDir, { recursive: true, force: true });
  mkdirSync(resultsDir, { recursive: true });
  const metadata: RunMetadata = { suite, runId, startedAt: new Date().toISOString() };
  writeFileSync(path.join(resultsDir, RUN_METADATA_FILE), `${JSON.stringify(metadata, null, 2)}\n`);

  const cli = require.resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', ...playwrightArgs], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, API_SUITE: suite, API_RUN_ID: runId }
  });

  process.exitCode = result.status ?? 1;
}

if (require.main === module) {
  main();
}
