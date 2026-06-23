import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type SuiteCoverage = {
  file: string;
  name: string;
  tests: number;
};

type CoverageSummary = {
  suites: SuiteCoverage[];
  totalScenarios: number;
  browserProjects: number;
  browserScenarioExecutions: number;
};

const browserProjects = 3;
const e2eDir = path.resolve('tests/e2e');
const readmePath = path.resolve('README.md');
const agentsPath = path.resolve('AGENTS.md');

const suiteNames: Record<string, string> = {
  'auth.spec.ts': 'Authentication',
  'cart.spec.ts': 'Cart',
  'category.spec.ts': 'Categories',
  'checkout.spec.ts': 'Checkout',
  'contact.spec.ts': 'Support',
  'home.spec.ts': 'Home Experience',
  'navigation.spec.ts': 'Navigation',
  'products.spec.ts': 'Product Discovery'
};

export function countE2eCoverage(testDir = e2eDir): CoverageSummary {
  const suites = readdirSync(testDir)
    .filter((file) => file.endsWith('.spec.ts'))
    .sort()
    .map((file) => {
      const source = readFileSync(path.join(testDir, file), 'utf8');
      return {
        file,
        name: suiteNames[file] ?? file.replace(/\.spec\.ts$/, ''),
        tests: countTests(source, file)
      };
    });
  const totalScenarios = suites.reduce((total, suite) => total + suite.tests, 0);

  return {
    suites,
    totalScenarios,
    browserProjects,
    browserScenarioExecutions: totalScenarios * browserProjects
  };
}

export function renderCoverageBlock(summary: CoverageSummary): string {
  return [
    `Last generated UI E2E suite snapshot: ${summary.totalScenarios} scenarios. Cross-browser execution runs those scenarios across ${summary.browserProjects} browser projects for ${summary.browserScenarioExecutions} browser-scenario executions.`,
    '',
    '| Business Area | Tests |',
    '| --- | ---: |',
    ...summary.suites.map((suite) => `| ${suite.name} | ${suite.tests} |`)
  ].join('\n');
}

function countTests(sourceText: string, fileName: string): number {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let count = 0;

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'test') {
      count += 1;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function replaceMarkedBlock(content: string, marker: string, replacement: string): string {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;

  if (!content.includes(start) || !content.includes(end)) {
    throw new Error(`Missing ${marker} markers.`);
  }

  return content.replace(new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`), `${start}\n${replacement}\n${end}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateFile(filePath: string, marker: string, block: string, checkOnly: boolean): boolean {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const current = readFileSync(filePath, 'utf8');
  const next = replaceMarkedBlock(current, marker, block);
  const changed = current !== next;

  if (changed && !checkOnly) {
    writeFileSync(filePath, next, 'utf8');
  }

  return changed;
}

export function runCoverageCounts(args = process.argv.slice(2)): void {
  const checkOnly = args.includes('--check');
  const summary = countE2eCoverage();
  const coverageBlock = renderCoverageBlock(summary);
  const changed = [
    updateFile(readmePath, 'coverage', coverageBlock, checkOnly),
    updateFile(agentsPath, 'coverage', coverageBlock, checkOnly)
  ].some(Boolean);

  if (checkOnly && changed) {
    throw new Error('Generated coverage counts are out of date. Run npm run coverage:counts.');
  }

  console.log(`Coverage counts ${checkOnly ? 'checked' : 'updated'}: ${summary.totalScenarios} scenarios, ${summary.browserScenarioExecutions} browser-scenario executions.`);
}

if (require.main === module) {
  runCoverageCounts();
}
