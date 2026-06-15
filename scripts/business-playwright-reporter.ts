import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { createRunSummary, writeBusinessReport } from './business-reporter';

type ScenarioStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

type ScenarioResult = {
  title: string;
  feature: string;
  status: ScenarioStatus;
  durationMs: number;
  attempts: number;
  tags: string[];
  file?: string;
  error?: string;
};

class BusinessPlaywrightReporter implements Reporter {
  private readonly scenarios = new Map<string, ScenarioResult>();
  private startTime = Date.now();

  onBegin(): void {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = `${test.location.file}:${test.location.line}:${test.title}`;
    const previous = this.scenarios.get(key);
    const durationMs = (previous?.durationMs ?? 0) + result.duration;
    const attempts = (previous?.attempts ?? 0) + 1;
    const titleParts = [...test.titlePath().slice(1, -1), test.title];

    this.scenarios.set(key, {
      title: cleanTitle(titleParts.join(' > ')),
      feature: featureFromFile(test.location.file),
      status: normalizeStatus(result.status),
      durationMs,
      attempts,
      tags: extractTags(test.title),
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
    writeBusinessReport(summary);
  }
}

function normalizeStatus(status: TestResult['status']): ScenarioStatus {
  if (status === 'timedOut') return 'timedOut';
  return status;
}

function featureFromFile(file: string): string {
  if (file.includes('auth')) return 'Authentication';
  if (file.includes('cart')) return 'Cart';
  if (file.includes('category')) return 'Category';
  if (file.includes('checkout')) return 'Checkout';
  if (file.includes('contact')) return 'Support';
  if (file.includes('navigation')) return 'Navigation';
  if (file.includes('products')) return 'Product Discovery';
  if (file.includes('home')) return 'Home Experience';
  return 'General';
}

function cleanTitle(title: string): string {
  return title.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();
}

function extractTags(title: string): string[] {
  return title.match(/@\w+/g) ?? [];
}

function normalizeFilePath(file: string): string {
  return file.replaceAll('\\', '/');
}

export default BusinessPlaywrightReporter;
