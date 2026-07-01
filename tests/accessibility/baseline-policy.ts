export type BaselineComparison = {
  newRuleIds: string[];
  removedRuleIds: string[];
};

export function compareRuleIds(currentRuleIds: readonly string[], baselineRuleIds: readonly string[]): BaselineComparison {
  const current = new Set(currentRuleIds);
  const baseline = new Set(baselineRuleIds);

  return {
    newRuleIds: [...current].filter((ruleId) => !baseline.has(ruleId)).sort(),
    removedRuleIds: [...baseline].filter((ruleId) => !current.has(ruleId)).sort()
  };
}
