// Evidence for failure triage: how many HTTP 5xx responses the demo site sent during one
// test attempt. The fixture records it as a test annotation, the JSON report carries it per
// attempt, and scripts/failure-triage.ts prints it beside the failure it belongs to.
// It is evidence only - classification stays with the error text in demo-site-classification.ts.

export const DEMO_SITE_SERVER_ERRORS_ANNOTATION = 'demo-site-5xx';

export type ServerErrorCounts = Record<string, number>;

// "503:28,500:1" - plain and stable, so the JSON report stays readable by hand.
export function formatServerErrorCounts(counts: ServerErrorCounts): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([status, count]) => `${status}:${count}`)
    .join(',');
}

export function parseServerErrorCounts(description: string | undefined): ServerErrorCounts {
  const counts: ServerErrorCounts = {};

  for (const entry of (description ?? '').split(',')) {
    const match = /^\s*(5\d\d):(\d+)\s*$/.exec(entry);
    if (match) {
      counts[match[1]] = (counts[match[1]] ?? 0) + Number(match[2]);
    }
  }

  return counts;
}

export function mergeServerErrorCounts(...all: ServerErrorCounts[]): ServerErrorCounts {
  const merged: ServerErrorCounts = {};

  for (const counts of all) {
    for (const [status, count] of Object.entries(counts)) {
      merged[status] = (merged[status] ?? 0) + count;
    }
  }

  return merged;
}

export function totalServerErrors(counts: ServerErrorCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

// "28 (503 x28)" or "29 (500 x1, 503 x28)"; "none observed" when there were none.
export function describeServerErrors(counts: ServerErrorCounts): string {
  const total = totalServerErrors(counts);
  if (!total) return 'none observed';

  const breakdown = formatServerErrorCounts(counts)
    .split(',')
    .map((entry) => entry.replace(':', ' x'))
    .join(', ');

  return `${total} (${breakdown})`;
}

export function isDemoSiteUrl(url: string, baseUrl: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }

  const demoHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  return host === demoHost || host.endsWith(`.${demoHost}`);
}
