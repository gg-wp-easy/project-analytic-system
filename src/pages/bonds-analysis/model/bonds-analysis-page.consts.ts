import type { BondAnalysisPreferences } from "../../../features/bonds-analysis";
import { VIZ_HEX } from "../../../shared/brand";

export const BONDS_STATE_KEY = "bonds-analysis-state-v8";
export const BONDS_PAGE_SIZE = 25;

// круговая диаграмма портфеля уходит в PDF — цвета в hex
export const BONDS_CHART_PALETTE = VIZ_HEX;
// уровни риска: низкий, средний, высокий
export const BONDS_RISK_PALETTE = ["var(--nk-up)", "var(--nk-viz-4)", "var(--nk-down)"];

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

export const BOND_RISK_LEVEL_OPTIONS = ["mixed", "0", "1", "2"] as const;
