import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { buildAccessibilitySummary, type AccessibilityScanAttachment, type AccessibilityStateResult } from './accessibility-report-model';

const axeVersion = (JSON.parse(readFileSync(path.resolve('node_modules/axe-core/package.json'), 'utf8')) as { version: string }).version;
const outputPath = path.resolve('accessibility-results/summary.json');

class AccessibilityPlaywrightReporter implements Reporter {
  private readonly states = new Map<string, AccessibilityStateResult>();

  onTestEnd(test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((item) => item.name === 'accessibility-state');
    const scan = attachment?.body ? (JSON.parse(attachment.body.toString('utf8')) as AccessibilityScanAttachment) : undefined;
    const tags = test.tags.length ? test.tags : test.title.match(/@\w+/g) ?? [];
    const caseId = tags.find((tag) => /^@A11Y\d{3}$/i.test(tag))?.slice(1).toUpperCase() ?? 'A11Y-UNKNOWN';
    const cleanTitle = test.title.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();
    const status = scan ? (scan.newRuleIds.length > 0 ? 'regression' : 'passed') : 'unavailable';

    this.states.set(caseId, {
      caseId,
      title: scan?.title ?? cleanTitle,
      tags: scan?.tags ?? tags,
      state: scan?.state ?? cleanTitle,
      status,
      currentRuleIds: scan?.currentRuleIds ?? [],
      newRuleIds: scan?.newRuleIds ?? [],
      removedRuleIds: scan?.removedRuleIds ?? [],
      durationMs: result.duration,
      error: scan ? undefined : result.error?.message ?? 'Accessibility scan evidence was not produced.'
    });
  }

  onEnd(): void {
    const summary = buildAccessibilitySummary({
      states: [...this.states.values()],
      engine: `axe-core ${axeVersion}`,
      browser: 'Chromium',
      sourceRevision: process.env.GITHUB_SHA ?? process.env.SOURCE_REVISION ?? 'local'
    });

    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  }
}

export default AccessibilityPlaywrightReporter;
