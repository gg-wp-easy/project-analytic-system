import type { OptimizerSettings } from "./optimizer-settings.types";

export const OPTIMIZER_SETTINGS_STORAGE_KEY = "optimizer-settings-v1";

export const DEFAULT_OPTIMIZER_SETTINGS: OptimizerSettings = {
  riskFreeRate: "14",
  minWeight: "1",
  maxWeight: "100",
  sharpeBlendWeight: "0",
  minRiskBlendWeight: "0",
  optimizationObjective: "min_risk_target_return",
  targetReturn: "20",
  targetRisk: "20",
  portfolioAssetsCount: "0",
  hideAnalysisDetails: true,
};
