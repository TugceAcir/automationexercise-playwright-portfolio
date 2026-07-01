export type AccessibilityStateStatus = 'passed' | 'regression' | 'unavailable';

export type AccessibilityStateResult = {
  caseId: string;
  title: string;
  tags: string[];
  state: string;
  status: AccessibilityStateStatus;
  currentRuleIds: string[];
  newRuleIds: string[];
  removedRuleIds: string[];
  durationMs: number;
  error?: string;
};

export type AccessibilitySummary = {
  generatedAt: string;
  standard: 'WCAG 2.1 A/AA';
  engine: string;
  browser: string;
  sourceRevision: string;
  totalStates: number;
  passedStates: number;
  regressionStates: number;
  unavailableStates: number;
  states: AccessibilityStateResult[];
};

export type AccessibilityScanAttachment = Pick<
  AccessibilityStateResult,
  'caseId' | 'title' | 'tags' | 'state' | 'currentRuleIds' | 'newRuleIds' | 'removedRuleIds'
>;

export function buildAccessibilitySummary(options: {
  states: AccessibilityStateResult[];
  engine: string;
  browser?: string;
  sourceRevision?: string;
  generatedAt?: string;
}): AccessibilitySummary {
  const states = [...options.states].sort((a, b) => a.caseId.localeCompare(b.caseId));

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    standard: 'WCAG 2.1 A/AA',
    engine: options.engine,
    browser: options.browser ?? 'Chromium',
    sourceRevision: options.sourceRevision ?? 'local',
    totalStates: states.length,
    passedStates: states.filter((state) => state.status === 'passed').length,
    regressionStates: states.filter((state) => state.status === 'regression').length,
    unavailableStates: states.filter((state) => state.status === 'unavailable').length,
    states
  };
}
