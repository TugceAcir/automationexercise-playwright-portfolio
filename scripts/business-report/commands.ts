import path from 'node:path';
import { normalizeFilePath } from './report-model';

export function commandPath(file: string): string {
  const relativePath = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file.includes('/') || file.includes('\\') ? file : path.join('tests/e2e', file);
  return normalizeFilePath(relativePath);
}

export function shellQuote(value: string): string {
  return /^[\w./:@-]+$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}
