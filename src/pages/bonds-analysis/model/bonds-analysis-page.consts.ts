import type { BondAnalysisPreferences } from "../../../features/bonds-analysis";

export const BONDS_STATE_KEY = "bonds-analysis-state-v6";
export const BONDS_PAGE_SIZE = 25;

export const BONDS_CHART_PALETTE = [
  "#b45309", "#f59e0b", "#f97316", "#fb7185", "#0ea5e9", "#14b8a6", "#84cc16", "#8b5cf6",
];
export const BONDS_RISK_PALETTE = ["#16a34a", "#0ea5e9", "#f59e0b", "#dc2626"];

export const DEFAULT_BOND_ANALYSIS_PREFERENCES: BondAnalysisPreferences = {
  investmentAmount: "100000",
  targetYieldPercent: "10",
  currency: "RUB",
  riskProfile: "mixed",
  minPositions: "10",
  maxPositions: "20",
  payoutFrequency: "quarterly",
  method: "matching",
  targetDurationYears: "3",
};

export const BOND_RISK_LEVEL_OPTIONS = ["mixed", "0", "1", "2", "3"] as const;