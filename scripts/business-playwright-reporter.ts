import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { createRunSummary, writeBusinessReport } from './business-report/core';
import { cleanTitle, extractTags, featureFromFile, normalizeFilePath, type ScenarioResult } from './business-report/report-model';

class BusinessPlaywrightReporter implements Reporter {
  private readonly scenarios = new Map<string, ScenarioResult>();
  private startTime = Date.now();

  onBegin(): void {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const browser = test.parent.project()?.name ?? 'chromium';
    const key = `${browser}:${test.location.file}:${test.location.line}:${test.title}`;
    const previous = this.scenarios.get(key);
    const durationMs = (previous?.durationMs ?? 0) + result.duration;
    const attempts = (previous?.attempts ?? 0) + 1;
    const titleParts = [...test.titlePath().slice(1, -1), test.title];

    this.scenarios.set(key, {
      title: cleanTitle(titleParts.join(' > ')),
      feature: featureFromFile(test.location.file),
      status: result.status,
      durationMs,
      attempts,
      tags: tagsForTest(test),
      browser,
      file: normalizeFilePath(test.location.file),
      error: result.error?.message
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const durationMs = result.duration || Date.now() - this.startTime;
    const summary = createRunSummary({
      scenarios: [...this.scenarios.values()],
      durationMs
    });
    writeBusinessReport(summary, { strictGherkin: process.env.BUSINESS_REPORT_STRICT === '1' });
  }
}

function tagsForTest(test: TestCase): string[] {
  return test.tags.length ? test.tags : extractTags(test.title);
}

export default BusinessPlaywrightReporter;
