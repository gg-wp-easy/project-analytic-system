import type { BondAnalysisPreferences } from "../../../features/bonds-analysis";

export const BONDS_STATE_KEY = "bonds-analysis-state-v3";
export const BONDS_PAGE_SIZE = 25;

export const BONDS_CHART_PALETTE = [
  "#b45309",
  "#f59e0b",
  "#f97316",
  "#fb7185",
  "#0ea5e9",
  "#14b8a6",
  "#84cc16",
  "#8b5cf6",
];

export const BONDS_RISK_PALETTE = ["#16a34a", "#0ea5e9", "#f59e0b", "#dc2626"];

export const DEFAULT_BOND_ANALYSIS_PREFERENCES: BondAnalysisPreferences = {
  targetYield: "12",
  targetDuration: "3.5",
  paymentFrequency: "quarterly",
  targetRiskLevel: "3",
  selectionMethod: "matching",
  portfolioBondsCount: "20",
};

export const BOND_RISK_LEVEL_OPTIONS = ["mixed", "0", "1", "2", "3"] as const;
