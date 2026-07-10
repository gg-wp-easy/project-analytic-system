import type { OptimizerSettings } from "./optimizer-settings.types";

export const OPTIMIZER_SETTINGS_STORAGE_KEY = "optimizer-settings-v1";

export const DEFAULT_OPTIMIZER_SETTINGS: OptimizerSettings = {
  riskFreeRate: "0",
  minWeight: "1",
  maxWeight: "1",
  sharpeBlendWeight: "0",
  minRiskBlendWeight: "0",
  optimizationObjective: "max_sharpe",
  portfolioAssetsCount: "0",
};
