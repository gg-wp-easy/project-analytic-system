import type { OptimizerSettings } from "./optimizer-settings.types";

export const OPTIMIZER_SETTINGS_STORAGE_KEY = "optimizer-settings-v1";

export const DEFAULT_OPTIMIZER_SETTINGS: OptimizerSettings = {
  riskFreeRate: "14",
  minWeight: "1",
  maxWeight: "10",
  sharpeBlendWeight: "0",
  minRiskBlendWeight: "0",
  optimizationObjective: "max_sharpe",
  targetReturn: "20",
  targetRisk: "20",
  portfolioAssetsCount: "20",
  hideAnalysisDetails: true,
  autoModelTuning: true,
  autoPortfolioOptimization: true,
};
