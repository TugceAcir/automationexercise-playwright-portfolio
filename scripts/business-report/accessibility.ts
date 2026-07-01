import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AccessibilityStateResult, AccessibilitySummary } from '../accessibility-report-model';

const defaultSummaryPath = path.resolve('accessibility-results/summary.json');

export function readAccessibilitySummary(summaryPath = defaultSummaryPath): AccessibilitySummary | undefined {
  if (!existsSync(summaryPath)) return undefined;

  try {
    const value = JSON.parse(readFileSync(summaryPath, 'utf8')) as Partial<AccessibilitySummary>;
    if (value.standard !== 'WCAG 2.1 A/AA' || !Array.isArray(value.states)) return undefined;
    if (!value.states.every(isAccessibilityState)) return undefined;
    if (typeof value.generatedAt !== 'string' || typeof value.engine !== 'string' || typeof value.browser !== 'string') return undefined;

    return value as AccessibilitySummary;
  } catch {
    return undefined;
  }
}

export function renderAccessibilityPanel(summary: AccessibilitySummary | undefined): string {
  if (!summary) {
    return `<div class="panel" aria-label="Accessibility results">
      <h2>Accessibility — WCAG 2.1 A/AA</h2>
      <div class="subtle"><strong>Results unavailable.</strong> Run <code>npm run test:a11y</code> before regenerating the business report.</div>
    </div>`;
  }

  const headline = summary.regressionStates > 0
    ? `${summary.regressionStates} state${summary.regressionStates === 1 ? '' : 's'} with new regressions`
    : `${summary.passedStates}/${summary.totalStates} states scanned — 0 new regressions`;
  const rows = summary.states.map(renderStateRow).join('\n');

  return `<div class="panel" aria-label="Accessibility results">
      <h2>Accessibility — ${escapeHtml(summary.standard)}</h2>
      <div class="a11y-summary"><strong>${escapeHtml(headline)}</strong><span>${escapeHtml(summary.browser)} | ${escapeHtml(summary.engine)} | Revision ${escapeHtml(shortRevision(summary.sourceRevision))} | ${escapeHtml(new Date(summary.generatedAt).toLocaleString())}</span></div>
      <div class="a11y-table" role="table" aria-label="Accessibility scan states">
        <div class="a11y-row a11y-header" role="row"><span>Case</span><span>Page state</span><span>Status</span><span>Known rule IDs</span><span>New</span><span>Resolved</span></div>
        ${rows}
      </div>
      <div class="subtle a11y-note"><strong>Interpretation:</strong> Known rule IDs are documented findings on the externally owned target site, not zero violations. Automated axe testing does not establish complete WCAG conformance; manual keyboard, focus, screen-reader, and content review remain necessary.</div>
    </div>`;
}

export function accessibilityExecutiveSummary(summary: AccessibilitySummary | undefined): string[] {
  if (!summary) return ['Accessibility: results unavailable'];

  return [
    `Accessibility scope: ${summary.standard} (${summary.browser}, ${summary.engine})`,
    `Accessibility states: ${summary.passedStates}/${summary.totalStates} passed baseline; ${summary.regressionStates} with new regressions; ${summary.unavailableStates} unavailable`,
    'Accessibility note: automated axe results do not establish complete WCAG conformance'
  ];
}

function renderStateRow(state: AccessibilityStateResult): string {
  const status = state.status === 'passed' ? 'Baseline passed' : state.status === 'regression' ? 'Regression' : 'Unavailable';
  const current = state.currentRuleIds.join(', ') || 'None';
  const added = state.newRuleIds.join(', ') || '—';
  const removed = state.removedRuleIds.join(', ') || '—';

  return `<div class="a11y-row" role="row">
          <strong>${escapeHtml(state.caseId)}</strong>
          <span><strong>${escapeHtml(state.title)}</strong><small>${escapeHtml(state.tags.join(' '))}</small></span>
          <span class="a11y-status a11y-${state.status}">${escapeHtml(status)}</span>
          <span>${escapeHtml(current)}</span>
          <span>${escapeHtml(added)}</span>
          <span>${escapeHtml(removed)}</span>
        </div>`;
}

function isAccessibilityState(value: unknown): value is AccessibilityStateResult {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AccessibilityStateResult>;
  return typeof state.caseId === 'string'
    && typeof state.title === 'string'
    && typeof state.state === 'string'
    && ['passed', 'regression', 'unavailable'].includes(state.status ?? '')
    && Array.isArray(state.tags)
    && Array.isArray(state.currentRuleIds)
    && Array.isArray(state.newRuleIds)
    && Array.isArray(state.removedRuleIds);
}

function shortRevision(revision: string): string {
  return revision === 'local' ? revision : revision.slice(0, 8);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
