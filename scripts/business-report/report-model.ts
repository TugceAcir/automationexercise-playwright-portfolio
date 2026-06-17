import type { PlaywrightResultStatus } from '../types/playwright-json';

export type ScenarioStatus = PlaywrightResultStatus;

export type ScenarioResult = {
  title: string;
  feature: string;
  status: ScenarioStatus;
  durationMs: number;
  attempts: number;
  tags: string[];
  browser: string;
  file?: string;
  error?: string;
};

export type RunSummary = {
  id: string;
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  confidenceScore: number;
  scenarios: ScenarioResult[];
};

export function featureFromFile(file = '', title = ''): string {
  const normalizedFile = normalizeFilePath(file).toLowerCase();
  const source = `${normalizedFile} ${title}`.toLowerCase();
  const feature = featureFromSource(normalizedFile) ?? featureFromSource(source);

  if (feature) return feature;
  return 'General';
}

function featureFromSource(source: string): string | undefined {
  if (source.includes('auth')) return 'Authentication';
  if (source.includes('cart')) return 'Cart';
  if (source.includes('category')) return 'Category';
  if (source.includes('checkout')) return 'Checkout';
  if (source.includes('contact')) return 'Support';
  if (source.includes('home')) return 'Home Experience';
  if (source.includes('navigation')) return 'Navigation';
  if (source.includes('products')) return 'Product Discovery';
  return undefined;
}

export function cleanTitle(title: string): string {
  return title.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();
}

export function extractTags(title: string): string[] {
  return title.match(/@\w+/g) ?? [];
}

export function normalizeFilePath(file: string): string {
  return file.replaceAll('\\', '/');
}

export function scenarioIdForScenario(scenario: ScenarioResult): string | undefined {
  return scenario.tags.find(isScenarioIdTag)?.replace('@', '').toUpperCase();
}

export function isScenarioIdTag(tag: string): boolean {
  return /^@?[A-Z]{2,12}\d{3}$/i.test(tag);
}
